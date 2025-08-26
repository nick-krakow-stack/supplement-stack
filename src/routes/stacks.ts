import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { CloudflareBindings, Stack, StackDetails, StackProdukt, ApiResponse, WirkstoffInteraktion } from '../types'

const stacks = new Hono<{ Bindings: CloudflareBindings }>()

const JWT_SECRET = 'supplement-stack-jwt-secret-2024'

// Middleware für Authentifizierung (optional für Demo)
const optionalAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const payload = await verify(token, JWT_SECRET)
      c.set('user', payload)
    } catch (error) {
      // Token invalid, aber optional auth für Demo
    }
  }
  await next()
}

// User's Stacks laden
stacks.get('/', optionalAuth, async (c) => {
  try {
    const user = c.get('user')
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Authentifizierung erforderlich'
      }, 401)
    }

    const stacksResult = await c.env.DB.prepare(`
      SELECT s.*, COUNT(sp.id) as produkt_anzahl,
        SUM(p.preis * sp.dosierung / p.einheit_anzahl * 30) as geschaetzte_monatliche_kosten
      FROM stacks s
      LEFT JOIN stack_produkte sp ON s.id = sp.stack_id
      LEFT JOIN produkte p ON sp.produkt_id = p.id
      WHERE s.user_id = ? AND s.is_demo = 0
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `).bind(user.userId).all()

    return c.json<ApiResponse<Stack[]>>({
      success: true,
      data: stacksResult.results as Stack[]
    })

  } catch (error) {
    console.error('Get stacks error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Stacks'
    }, 500)
  }
})

// Stack-Details mit Produkten und Analysen
stacks.get('/:id', optionalAuth, async (c) => {
  try {
    const stackId = parseInt(c.req.param('id'))
    const user = c.get('user')

    // Stack laden (mit Demo-Check)
    let stackQuery = 'SELECT * FROM stacks WHERE id = ?'
    const queryParams = [stackId]

    if (user) {
      stackQuery += ' AND (user_id = ? OR is_demo = 1)'
      queryParams.push(user.userId)
    } else {
      stackQuery += ' AND is_demo = 1'
    }

    const stack = await c.env.DB.prepare(stackQuery).bind(...queryParams).first() as Stack | null

    if (!stack) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404)
    }

    // Stack-Produkte mit Details laden
    const stackProdukteResult = await c.env.DB.prepare(`
      SELECT sp.*, p.name as produkt_name, p.marke, p.preis, p.einheit_anzahl, 
        p.shop_link, p.affiliate_link, p.bild_url,
        GROUP_CONCAT(
          w.name || ': ' || pw.menge || ' ' || pw.einheit || 
          CASE WHEN wf.name IS NOT NULL THEN ' (' || wf.name || ')' ELSE '' END,
          ' | '
        ) as wirkstoffe_info
      FROM stack_produkte sp
      JOIN produkte p ON sp.produkt_id = p.id
      LEFT JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id
      LEFT JOIN wirkstoffe w ON pw.wirkstoff_id = w.id
      LEFT JOIN wirkstoff_formen wf ON pw.form_id = wf.id
      WHERE sp.stack_id = ?
      GROUP BY sp.id
      ORDER BY sp.created_at
    `).bind(stackId).all()

    // Wirkstoff-Summen berechnen
    const wirkstoffSummenResult = await c.env.DB.prepare(`
      SELECT w.id, w.name, w.einheit, 
        SUM(pw.menge * sp.dosierung) as gesamtmenge,
        GROUP_CONCAT(DISTINCT p.name) as produkt_namen
      FROM stack_produkte sp
      JOIN produkte p ON sp.produkt_id = p.id
      JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id
      JOIN wirkstoffe w ON pw.wirkstoff_id = w.id
      WHERE sp.stack_id = ?
      GROUP BY w.id, w.name, w.einheit
      ORDER BY w.name
    `).bind(stackId).all()

    // Interaktionen prüfen
    const interaktionenResult = await c.env.DB.prepare(`
      SELECT DISTINCT wi.*, wa.name as wirkstoff_a_name, wb.name as wirkstoff_b_name
      FROM stack_produkte sp1
      JOIN produkte p1 ON sp1.produkt_id = p1.id
      JOIN produkt_wirkstoffe pw1 ON p1.id = pw1.produkt_id
      JOIN stack_produkte sp2 ON sp1.stack_id = sp2.stack_id AND sp1.id != sp2.id
      JOIN produkte p2 ON sp2.produkt_id = p2.id
      JOIN produkt_wirkstoffe pw2 ON p2.id = pw2.produkt_id
      JOIN wirkstoff_interaktionen wi ON 
        (wi.wirkstoff_a_id = pw1.wirkstoff_id AND wi.wirkstoff_b_id = pw2.wirkstoff_id)
        OR (wi.wirkstoff_a_id = pw2.wirkstoff_id AND wi.wirkstoff_b_id = pw1.wirkstoff_id)
      JOIN wirkstoffe wa ON wi.wirkstoff_a_id = wa.id
      JOIN wirkstoffe wb ON wi.wirkstoff_b_id = wb.id
      WHERE sp1.stack_id = ?
    `).bind(stackId).all()

    // Gesamtpreis berechnen
    const gesamtpreisResult = stackProdukteResult.results.reduce((sum: number, sp: any) => {
      const produktPreis = sp.preis / sp.einheit_anzahl
      const monatskosten = produktPreis * sp.dosierung * 30
      return sum + monatskosten
    }, 0)

    const stackDetails: StackDetails = {
      ...stack,
      produkte: stackProdukteResult.results.map((sp: any) => ({
        stack_produkt: {
          id: sp.id,
          stack_id: sp.stack_id,
          produkt_id: sp.produkt_id,
          dosierung: sp.dosierung,
          einnahmezeit: sp.einnahmezeit,
          notiz: sp.notiz,
          created_at: sp.created_at
        },
        produkt: {
          id: sp.produkt_id,
          name: sp.produkt_name,
          marke: sp.marke,
          preis: sp.preis,
          einheit_anzahl: sp.einheit_anzahl,
          shop_link: sp.shop_link,
          affiliate_link: sp.affiliate_link,
          bild_url: sp.bild_url,
          wirkstoffe_info: sp.wirkstoffe_info,
          preis_pro_monat: Math.round(sp.preis / sp.einheit_anzahl * sp.dosierung * 30 * 100) / 100
        } as any
      })),
      gesamtpreis_monat: Math.round(gesamtpreisResult * 100) / 100,
      wirkstoff_summen: wirkstoffSummenResult.results.map((ws: any) => ({
        wirkstoff: {
          id: ws.id,
          name: ws.name,
          einheit: ws.einheit
        },
        gesamtmenge: ws.gesamtmenge,
        einheit: ws.einheit,
        produkte: ws.produkt_namen ? ws.produkt_namen.split(',') : []
      })),
      interaktionen: interaktionenResult.results as WirkstoffInteraktion[]
    }

    return c.json<ApiResponse<StackDetails>>({
      success: true,
      data: stackDetails
    })

  } catch (error) {
    console.error('Get stack details error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden des Stacks'
    }, 500)
  }
})

// Neuen Stack erstellen
stacks.post('/', optionalAuth, async (c) => {
  try {
    const user = c.get('user')
    
    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Authentifizierung erforderlich'
      }, 401)
    }

    const { name, beschreibung } = await c.req.json()

    if (!name) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stack-Name ist erforderlich'
      }, 400)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO stacks (user_id, name, beschreibung) 
      VALUES (?, ?, ?)
    `).bind(user.userId, name, beschreibung || null).run()

    const stackId = result.meta.last_row_id as number

    return c.json<ApiResponse<{ stack_id: number }>>({
      success: true,
      data: { stack_id: stackId },
      message: 'Stack erfolgreich erstellt'
    })

  } catch (error) {
    console.error('Create stack error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Erstellen des Stacks'
    }, 500)
  }
})

// Produkt zum Stack hinzufügen
stacks.post('/:id/produkte', optionalAuth, async (c) => {
  try {
    const stackId = parseInt(c.req.param('id'))
    const user = c.get('user')
    const { produkt_id, dosierung, einnahmezeit, notiz } = await c.req.json()

    // Stack-Berechtigung prüfen
    let stackQuery = 'SELECT * FROM stacks WHERE id = ?'
    const queryParams = [stackId]

    if (user) {
      stackQuery += ' AND (user_id = ? OR is_demo = 1)'
      queryParams.push(user.userId)
    } else {
      stackQuery += ' AND is_demo = 1'
    }

    const stack = await c.env.DB.prepare(stackQuery).bind(...queryParams).first()

    if (!stack) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404)
    }

    // Prüfen ob Produkt bereits im Stack ist
    const existingProduct = await c.env.DB.prepare(
      'SELECT id FROM stack_produkte WHERE stack_id = ? AND produkt_id = ?'
    ).bind(stackId, produkt_id).first()

    if (existingProduct) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Produkt ist bereits im Stack enthalten'
      }, 409)
    }

    // Produkt zum Stack hinzufügen
    await c.env.DB.prepare(`
      INSERT INTO stack_produkte (stack_id, produkt_id, dosierung, einnahmezeit, notiz)
      VALUES (?, ?, ?, ?, ?)
    `).bind(stackId, produkt_id, dosierung || 1, einnahmezeit || null, notiz || null).run()

    // Stack updated_at aktualisieren
    await c.env.DB.prepare(
      'UPDATE stacks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(stackId).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Produkt erfolgreich zum Stack hinzugefügt'
    })

  } catch (error) {
    console.error('Add product to stack error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Hinzufügen des Produkts'
    }, 500)
  }
})

// Produkt aus Stack entfernen
stacks.delete('/:stackId/produkte/:produktId', optionalAuth, async (c) => {
  try {
    const stackId = parseInt(c.req.param('stackId'))
    const produktId = parseInt(c.req.param('produktId'))
    const user = c.get('user')

    // Stack-Berechtigung prüfen
    let stackQuery = 'SELECT * FROM stacks WHERE id = ?'
    const queryParams = [stackId]

    if (user) {
      stackQuery += ' AND (user_id = ? OR is_demo = 1)'
      queryParams.push(user.userId)
    } else {
      stackQuery += ' AND is_demo = 1'
    }

    const stack = await c.env.DB.prepare(stackQuery).bind(...queryParams).first()

    if (!stack) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404)
    }

    // Produkt aus Stack entfernen
    await c.env.DB.prepare(
      'DELETE FROM stack_produkte WHERE stack_id = ? AND produkt_id = ?'
    ).bind(stackId, produktId).run()

    // Stack updated_at aktualisieren
    await c.env.DB.prepare(
      'UPDATE stacks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(stackId).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Produkt aus Stack entfernt'
    })

  } catch (error) {
    console.error('Remove product from stack error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Entfernen des Produkts'
    }, 500)
  }
})

// Stack-Dosierung aktualisieren
stacks.put('/:stackId/produkte/:produktId', optionalAuth, async (c) => {
  try {
    const stackId = parseInt(c.req.param('stackId'))
    const produktId = parseInt(c.req.param('produktId'))
    const user = c.get('user')
    const { dosierung, einnahmezeit, notiz } = await c.req.json()

    // Stack-Berechtigung prüfen
    let stackQuery = 'SELECT * FROM stacks WHERE id = ?'
    const queryParams = [stackId]

    if (user) {
      stackQuery += ' AND (user_id = ? OR is_demo = 1)'
      queryParams.push(user.userId)
    } else {
      stackQuery += ' AND is_demo = 1'
    }

    const stack = await c.env.DB.prepare(stackQuery).bind(...queryParams).first()

    if (!stack) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404)
    }

    // Stack-Produkt aktualisieren
    await c.env.DB.prepare(`
      UPDATE stack_produkte 
      SET dosierung = ?, einnahmezeit = ?, notiz = ?
      WHERE stack_id = ? AND produkt_id = ?
    `).bind(dosierung, einnahmezeit || null, notiz || null, stackId, produktId).run()

    // Stack updated_at aktualisieren
    await c.env.DB.prepare(
      'UPDATE stacks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(stackId).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Dosierung erfolgreich aktualisiert'
    })

  } catch (error) {
    console.error('Update stack product error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Aktualisieren der Dosierung'
    }, 500)
  }
})

// Stack löschen
stacks.delete('/:id', optionalAuth, async (c) => {
  try {
    const stackId = parseInt(c.req.param('id'))
    const user = c.get('user')

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Authentifizierung erforderlich'
      }, 401)
    }

    // Stack-Berechtigung prüfen (nur eigene Stacks löschen)
    const stack = await c.env.DB.prepare(
      'SELECT * FROM stacks WHERE id = ? AND user_id = ? AND is_demo = 0'
    ).bind(stackId, user.userId).first()

    if (!stack) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404)
    }

    // Stack und alle Produkte löschen (Cascade über FK)
    await c.env.DB.prepare('DELETE FROM stacks WHERE id = ?').bind(stackId).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Stack erfolgreich gelöscht'
    })

  } catch (error) {
    console.error('Delete stack error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Löschen des Stacks'
    }, 500)
  }
})

export default stacks