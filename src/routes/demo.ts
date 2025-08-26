import { Hono } from 'hono'
import type { CloudflareBindings, DemoSession, ApiResponse } from '../types'

const demo = new Hono<{ Bindings: CloudflareBindings }>()

// Demo-Session erstellen oder bestehende laden
demo.post('/session', async (c) => {
  try {
    let sessionKey = c.req.query('key')

    if (!sessionKey) {
      // Neue Demo-Session erstellen
      sessionKey = 'demo-' + Math.random().toString(36).substring(2, 15) + Date.now()
      
      // Demo-Session in DB speichern
      await c.env.DB.prepare(`
        INSERT INTO demo_sessions (session_key, expires_at)
        VALUES (?, datetime('now', '+24 hours'))
      `).bind(sessionKey).run()

      // Demo-Stack erstellen
      const stackResult = await c.env.DB.prepare(`
        INSERT INTO stacks (name, beschreibung, is_demo, demo_session_key, expires_at)
        VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
      `).bind(
        'Mein Demo Stack',
        'Teststack im Playground-Modus',
        true,
        sessionKey
      ).run()

      const stackId = stackResult.meta.last_row_id as number

      return c.json<ApiResponse<{ session_key: string, stack_id: number }>>({
        success: true,
        data: { session_key: sessionKey, stack_id: stackId },
        message: 'Demo-Session erstellt. Daten werden in 24h automatisch gelöscht.'
      })
    } else {
      // Bestehende Session prüfen
      const session = await c.env.DB.prepare(
        'SELECT * FROM demo_sessions WHERE session_key = ? AND expires_at > datetime("now")'
      ).bind(sessionKey).first() as DemoSession | null

      if (!session) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Demo-Session abgelaufen oder nicht gefunden'
        }, 404)
      }

      // Demo-Stack finden
      const stack = await c.env.DB.prepare(
        'SELECT id FROM stacks WHERE demo_session_key = ? AND is_demo = 1'
      ).bind(sessionKey).first()

      if (!stack) {
        // Neuen Demo-Stack erstellen falls nicht vorhanden
        const stackResult = await c.env.DB.prepare(`
          INSERT INTO stacks (name, beschreibung, is_demo, demo_session_key, expires_at)
          VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
        `).bind(
          'Mein Demo Stack',
          'Teststack im Playground-Modus',
          true,
          sessionKey
        ).run()

        return c.json<ApiResponse<{ session_key: string, stack_id: number }>>({
          success: true,
          data: { session_key: sessionKey, stack_id: stackResult.meta.last_row_id as number }
        })
      }

      // Last accessed aktualisieren
      await c.env.DB.prepare(
        'UPDATE demo_sessions SET last_accessed = CURRENT_TIMESTAMP WHERE session_key = ?'
      ).bind(sessionKey).run()

      return c.json<ApiResponse<{ session_key: string, stack_id: number }>>({
        success: true,
        data: { session_key: sessionKey, stack_id: stack.id }
      })
    }

  } catch (error) {
    console.error('Demo session error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler bei der Demo-Session'
    }, 500)
  }
})

// Demo-Session Status prüfen
demo.get('/session/:key', async (c) => {
  try {
    const sessionKey = c.req.param('key')

    const session = await c.env.DB.prepare(
      'SELECT * FROM demo_sessions WHERE session_key = ?'
    ).bind(sessionKey).first() as DemoSession | null

    if (!session) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Demo-Session nicht gefunden'
      }, 404)
    }

    const isExpired = new Date(session.expires_at) < new Date()

    if (isExpired) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Demo-Session abgelaufen'
      }, 410)
    }

    // Demo-Stack finden
    const stack = await c.env.DB.prepare(
      'SELECT id, name FROM stacks WHERE demo_session_key = ? AND is_demo = 1'
    ).bind(sessionKey).first()

    return c.json<ApiResponse>({
      success: true,
      data: {
        session_key: sessionKey,
        expires_at: session.expires_at,
        stack_id: stack?.id,
        stack_name: stack?.name,
        time_left: Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000))
      }
    })

  } catch (error) {
    console.error('Demo session status error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Demo-Session'
    }, 500)
  }
})

// Demo-Session zurücksetzen
demo.post('/session/:key/reset', async (c) => {
  try {
    const sessionKey = c.req.param('key')

    // Session prüfen
    const session = await c.env.DB.prepare(
      'SELECT * FROM demo_sessions WHERE session_key = ? AND expires_at > datetime("now")'
    ).bind(sessionKey).first()

    if (!session) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Demo-Session nicht gefunden oder abgelaufen'
      }, 404)
    }

    // Demo-Stack zurücksetzen (alle Produkte entfernen)
    await c.env.DB.prepare(`
      DELETE FROM stack_produkte 
      WHERE stack_id IN (
        SELECT id FROM stacks WHERE demo_session_key = ? AND is_demo = 1
      )
    `).bind(sessionKey).run()

    // Stack-Namen zurücksetzen
    await c.env.DB.prepare(`
      UPDATE stacks 
      SET name = 'Mein Demo Stack', beschreibung = 'Teststack im Playground-Modus',
          updated_at = CURRENT_TIMESTAMP
      WHERE demo_session_key = ? AND is_demo = 1
    `).bind(sessionKey).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Demo-Stack zurückgesetzt'
    })

  } catch (error) {
    console.error('Demo session reset error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Zurücksetzen der Demo-Session'
    }, 500)
  }
})

// Cleanup abgelaufener Demo-Sessions (Cron-Job Ersatz)
demo.post('/cleanup', async (c) => {
  try {
    // Abgelaufene Demo-Sessions und Stacks löschen
    await c.env.DB.prepare(`
      DELETE FROM demo_sessions 
      WHERE expires_at < datetime('now')
    `).run()

    await c.env.DB.prepare(`
      DELETE FROM stacks 
      WHERE is_demo = 1 AND expires_at < datetime('now')
    `).run()

    return c.json<ApiResponse>({
      success: true,
      message: 'Cleanup erfolgreich ausgeführt'
    })

  } catch (error) {
    console.error('Demo cleanup error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Cleanup'
    }, 500)
  }
})

// Demo-Informationen für Banner
demo.get('/info', async (c) => {
  try {
    const totalDemoSessions = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM demo_sessions WHERE expires_at > datetime("now")'
    ).first() as { count: number }

    const activeDemoStacks = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM stacks WHERE is_demo = 1 AND expires_at > datetime("now")'
    ).first() as { count: number }

    const sampleWirkstoffe = await c.env.DB.prepare(`
      SELECT w.name, COUNT(p.id) as produkt_anzahl
      FROM wirkstoffe w
      JOIN produkt_wirkstoffe pw ON w.id = pw.wirkstoff_id AND pw.ist_hauptwirkstoff = 1
      JOIN produkte p ON pw.produkt_id = p.id AND p.moderation_status = 'approved'
      GROUP BY w.id
      HAVING produkt_anzahl > 0
      ORDER BY produkt_anzahl DESC
      LIMIT 6
    `).all()

    return c.json<ApiResponse>({
      success: true,
      data: {
        demo_sessions: totalDemoSessions.count,
        demo_stacks: activeDemoStacks.count,
        sample_wirkstoffe: sampleWirkstoffe.results,
        features: [
          'Wirkstoffbasierte Suche testen',
          'Produkte zu Demo-Stack hinzufügen',
          'Interaktionswarnungen sehen',
          'Preisberechnung ausprobieren'
        ],
        limitations: [
          'Keine Produktanlage möglich',
          'Keine Wunschliste verfügbar',
          'Daten werden nach 24h gelöscht',
          'Session-basiert, kein Account nötig'
        ]
      }
    })

  } catch (error) {
    console.error('Demo info error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Demo-Informationen'
    }, 500)
  }
})

export default demo