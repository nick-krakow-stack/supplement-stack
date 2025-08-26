import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { CloudflareBindings, ApiResponse } from '../types'

const admin = new Hono<{ Bindings: CloudflareBindings }>()

const JWT_SECRET = 'supplement-stack-jwt-secret-2024'

// Admin-Auth Middleware
const requireAdmin = async (c: any, next: any) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Authentifizierung erforderlich'
      }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await verify(token, JWT_SECRET)

    if (payload.role !== 'admin') {
      return c.json<ApiResponse>({
        success: false,
        error: 'Admin-Berechtigung erforderlich'
      }, 403)
    }

    c.set('user', payload)
    await next()
  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Ungültiger Token'
    }, 401)
  }
}

// Dashboard-Statistiken
admin.get('/dashboard', requireAdmin, async (c) => {
  try {
    // Basis-Statistiken
    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE role = "user"'
    ).first() as { count: number }

    const produktCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM produkte WHERE moderation_status = "approved"'
    ).first() as { count: number }

    const pendingProdukte = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM produkte WHERE moderation_status = "pending"'
    ).first() as { count: number }

    const wirkstoffCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM wirkstoffe'
    ).first() as { count: number }

    const stackCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM stacks WHERE is_demo = 0'
    ).first() as { count: number }

    const demoStackCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM stacks WHERE is_demo = 1 AND expires_at > datetime("now")'
    ).first() as { count: number }

    // Top Wirkstoffe
    const topWirkstoffe = await c.env.DB.prepare(`
      SELECT w.name, COUNT(sp.id) as verwendungen,
        COUNT(DISTINCT p.id) as produkt_anzahl
      FROM wirkstoffe w
      LEFT JOIN produkt_wirkstoffe pw ON w.id = pw.wirkstoff_id
      LEFT JOIN produkte p ON pw.produkt_id = p.id AND p.moderation_status = 'approved'
      LEFT JOIN stack_produkte sp ON p.id = sp.produkt_id
      GROUP BY w.id, w.name
      HAVING produkt_anzahl > 0
      ORDER BY verwendungen DESC
      LIMIT 10
    `).all()

    // Neue User (letzte 30 Tage)
    const newUsers = await c.env.DB.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users 
      WHERE created_at >= datetime('now', '-30 days') AND role = 'user'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `).all()

    // Moderation Queue
    const moderationQueue = await c.env.DB.prepare(`
      SELECT p.*, u.email as einreicher_email, u.name as einreicher_name,
        COUNT(pw.id) as wirkstoff_anzahl
      FROM produkte p
      LEFT JOIN users u ON p.einreichung_user_id = u.id
      LEFT JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id
      WHERE p.moderation_status = 'pending'
      GROUP BY p.id
      ORDER BY p.created_at ASC
      LIMIT 20
    `).all()

    return c.json<ApiResponse>({
      success: true,
      data: {
        statistics: {
          users: userCount.count,
          products: produktCount.count,
          pending_products: pendingProdukte.count,
          wirkstoffe: wirkstoffCount.count,
          stacks: stackCount.count,
          demo_stacks: demoStackCount.count
        },
        top_wirkstoffe: topWirkstoffe.results,
        new_users: newUsers.results,
        moderation_queue: moderationQueue.results
      }
    })

  } catch (error) {
    console.error('Admin dashboard error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden des Dashboards'
    }, 500)
  }
})

// Produkt-Moderation
admin.get('/produkte', requireAdmin, async (c) => {
  try {
    const status = c.req.query('status') || 'pending'
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    const produkteResult = await c.env.DB.prepare(`
      SELECT p.*, u.email as einreicher_email, u.name as einreicher_name,
        GROUP_CONCAT(w.name || ': ' || pw.menge || ' ' || pw.einheit) as wirkstoffe_info
      FROM produkte p
      LEFT JOIN users u ON p.einreichung_user_id = u.id
      LEFT JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id
      LEFT JOIN wirkstoffe w ON pw.wirkstoff_id = w.id
      WHERE p.moderation_status = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all()

    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM produkte WHERE moderation_status = ?'
    ).bind(status).first() as { total: number }

    return c.json<ApiResponse>({
      success: true,
      data: {
        produkte: produkteResult.results,
        pagination: {
          page,
          limit,
          total: totalResult.total,
          pages: Math.ceil(totalResult.total / limit)
        }
      }
    })

  } catch (error) {
    console.error('Admin products error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Produkte'
    }, 500)
  }
})

// Produkt moderieren (genehmigen/ablehnen)
admin.post('/produkte/:id/moderate', requireAdmin, async (c) => {
  try {
    const produktId = parseInt(c.req.param('id'))
    const { action, reason } = await c.req.json() // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültige Aktion'
      }, 400)
    }

    const status = action === 'approve' ? 'approved' : 'rejected'

    await c.env.DB.prepare(
      'UPDATE produkte SET moderation_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, produktId).run()

    // Audit Log
    const user = c.get('user')
    await c.env.DB.prepare(`
      INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.userId,
      `moderate_product_${action}`,
      'produkte',
      produktId,
      JSON.stringify({ status, reason: reason || null })
    ).run()

    return c.json<ApiResponse>({
      success: true,
      message: `Produkt erfolgreich ${action === 'approve' ? 'genehmigt' : 'abgelehnt'}`
    })

  } catch (error) {
    console.error('Admin moderate product error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler bei der Moderation'
    }, 500)
  }
})

// Empfehlungen verwalten
admin.get('/wirkstoffe/:id/empfehlungen', requireAdmin, async (c) => {
  try {
    const wirkstoffId = parseInt(c.req.param('id'))

    const empfehlungenResult = await c.env.DB.prepare(`
      SELECT we.*, p.name as produkt_name, p.marke, p.preis
      FROM wirkstoff_empfehlungen we
      JOIN produkte p ON we.produkt_id = p.id
      WHERE we.wirkstoff_id = ?
      ORDER BY we.typ DESC, we.reihenfolge ASC
    `).bind(wirkstoffId).all()

    const verfuegbareProdukte = await c.env.DB.prepare(`
      SELECT DISTINCT p.*
      FROM produkte p
      JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id
      WHERE pw.wirkstoff_id = ? 
        AND p.moderation_status = 'approved'
        AND p.id NOT IN (
          SELECT produkt_id FROM wirkstoff_empfehlungen WHERE wirkstoff_id = ?
        )
      ORDER BY p.name
    `).bind(wirkstoffId, wirkstoffId).all()

    return c.json<ApiResponse>({
      success: true,
      data: {
        empfehlungen: empfehlungenResult.results,
        verfuegbare_produkte: verfuegbareProdukte.results
      }
    })

  } catch (error) {
    console.error('Admin empfehlungen error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Empfehlungen'
    }, 500)
  }
})

// Empfehlung hinzufügen
admin.post('/wirkstoffe/:wirkstoffId/empfehlungen', requireAdmin, async (c) => {
  try {
    const wirkstoffId = parseInt(c.req.param('wirkstoffId'))
    const { produkt_id, typ, reihenfolge, kommentar } = await c.req.json()

    if (!['empfohlen', 'alternative'].includes(typ)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültiger Empfehlungstyp'
      }, 400)
    }

    await c.env.DB.prepare(`
      INSERT INTO wirkstoff_empfehlungen (wirkstoff_id, produkt_id, typ, reihenfolge, kommentar)
      VALUES (?, ?, ?, ?, ?)
    `).bind(wirkstoffId, produkt_id, typ, reihenfolge || 0, kommentar || null).run()

    // Audit Log
    const user = c.get('user')
    await c.env.DB.prepare(`
      INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.userId,
      'add_empfehlung',
      'wirkstoff_empfehlungen',
      wirkstoffId,
      JSON.stringify({ produkt_id, typ, reihenfolge, kommentar })
    ).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Empfehlung erfolgreich hinzugefügt'
    })

  } catch (error) {
    console.error('Admin add empfehlung error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Hinzufügen der Empfehlung'
    }, 500)
  }
})

// Empfehlung entfernen
admin.delete('/empfehlungen/:id', requireAdmin, async (c) => {
  try {
    const empfehlungId = parseInt(c.req.param('id'))

    await c.env.DB.prepare(
      'DELETE FROM wirkstoff_empfehlungen WHERE id = ?'
    ).bind(empfehlungId).run()

    // Audit Log
    const user = c.get('user')
    await c.env.DB.prepare(`
      INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      user.userId,
      'delete_empfehlung',
      'wirkstoff_empfehlungen',
      empfehlungId,
      JSON.stringify({ deleted: true })
    ).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Empfehlung erfolgreich entfernt'
    })

  } catch (error) {
    console.error('Admin delete empfehlung error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Entfernen der Empfehlung'
    }, 500)
  }
})

// Audit Log anzeigen
admin.get('/audit', requireAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = (page - 1) * limit

    const auditResult = await c.env.DB.prepare(`
      SELECT al.*, u.email as user_email, u.name as user_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all()

    return c.json<ApiResponse>({
      success: true,
      data: {
        audit_entries: auditResult.results,
        pagination: { page, limit }
      }
    })

  } catch (error) {
    console.error('Admin audit error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden des Audit Logs'
    }, 500)
  }
})

export default admin