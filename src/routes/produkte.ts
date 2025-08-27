import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { CloudflareBindings, Produkt, ProduktDetails, CreateProduktRequest, ApiResponse, SearchParams } from '../types'
import { calculateSimpleDosage } from '../utils/simple-dosage-calculator'

const produkte = new Hono<{ Bindings: CloudflareBindings }>()

const JWT_SECRET = 'supplement-stack-jwt-secret-2024'

// Middleware für Authentifizierung (optional)
const optionalAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const payload = await verify(token, JWT_SECRET)
      c.set('user', payload)
    } catch (error) {
      // Token invalid, aber optional auth
    }
  }
  await next()
}

// Produkte für einen Wirkstoff laden (Modal 2) mit präziser Dosierungsberechnung
produkte.get('/by-wirkstoff/:wirkstoffId', optionalAuth, async (c) => {
  try {
    const wirkstoffId = parseInt(c.req.param('wirkstoffId'))
    const showAlternatives = c.req.query('alternatives') === 'true'
    const gewuenschteDosis = parseFloat(c.req.query('dosis') || '0') // Gewünschte Tagesdosis

    if (!wirkstoffId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültige Wirkstoff-ID'
      }, 400)
    }

    // Einfache Query ohne nicht-existierende Tabellen
    let produktQuery = `
      SELECT DISTINCT p.*, we.typ as empfehlung_typ, we.reihenfolge,
        pw_main.menge as hauptwirkstoff_menge,
        pw_main.einheit as hauptwirkstoff_einheit,
        wf.name as form_name, wf.kommentar as form_kommentar, wf.score as form_score
      FROM produkte p
      LEFT JOIN wirkstoff_empfehlungen we ON p.id = we.produkt_id AND we.wirkstoff_id = ?
      JOIN produkt_wirkstoffe pw_main ON p.id = pw_main.produkt_id 
        AND pw_main.wirkstoff_id = ? 
        AND pw_main.ist_hauptwirkstoff = 1
      LEFT JOIN wirkstoff_formen wf ON pw_main.form_id = wf.id
      WHERE p.moderation_status = 'approved' AND p.sichtbarkeit = 1
    `

    if (!showAlternatives) {
      produktQuery += ` AND (we.typ = 'empfohlen' OR we.typ IS NULL)`
    }

    produktQuery += `
      ORDER BY 
        CASE WHEN we.typ = 'empfohlen' THEN 1 
             WHEN we.typ IS NULL THEN 2 
             ELSE 3 END,
        we.reihenfolge ASC,
        wf.score DESC,
        p.preis ASC
    `

    const produkteResult = await c.env.DB.prepare(produktQuery)
      .bind(wirkstoffId, wirkstoffId).all()

    const produkteWithDetails = await Promise.all(
      produkteResult.results.map(async (produkt: any) => {
        // Alle Wirkstoffe des Produkts laden
        const wirkstoffeResult = await c.env.DB.prepare(`
          SELECT w.*, pw.menge, pw.einheit, pw.ist_hauptwirkstoff,
            wf.name as form_name, wf.kommentar as form_kommentar
          FROM produkt_wirkstoffe pw
          JOIN wirkstoffe w ON pw.wirkstoff_id = w.id
          LEFT JOIN wirkstoff_formen wf ON pw.form_id = wf.id
          WHERE pw.produkt_id = ?
          ORDER BY pw.ist_hauptwirkstoff DESC, w.name
        `).bind(produkt.id).all()

        // Intelligente Dosierungsberechnung
        const dosageResult = calculateSimpleDosage(produkt, gewuenschteDosis)
        const preis_pro_tag = dosageResult.preis_pro_tag
        const preis_pro_monat = dosageResult.preis_pro_monat

        return {
          ...produkt,
          wirkstoffe: wirkstoffeResult.results,
          hauptwirkstoffe: wirkstoffeResult.results.filter((w: any) => w.ist_hauptwirkstoff),
          preis_pro_tag: Math.round(preis_pro_tag * 100) / 100,
          preis_pro_monat: Math.round(preis_pro_monat * 100) / 100,
          empfehlung_typ: produkt.empfehlung_typ || 'neutral',
          dosage_info: dosageResult // Zusätzliche Dosierungsinfos für Frontend
        }
      })
    )

    return c.json<ApiResponse<ProduktDetails[]>>({
      success: true,
      data: produkteWithDetails
    })

  } catch (error) {
    console.error('Products by wirkstoff error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Produkte'
    }, 500)
  }
})

// Produkt-Details laden
produkte.get('/:id', optionalAuth, async (c) => {
  try {
    const produktId = parseInt(c.req.param('id'))

    const produkt = await c.env.DB.prepare(
      'SELECT * FROM produkte WHERE id = ? AND moderation_status = "approved" AND sichtbarkeit = 1'
    ).bind(produktId).first() as Produkt | null

    if (!produkt) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Produkt nicht gefunden'
      }, 404)
    }

    // Wirkstoffe laden
    const wirkstoffeResult = await c.env.DB.prepare(`
      SELECT w.*, pw.menge, pw.einheit, pw.ist_hauptwirkstoff,
        wf.name as form_name, wf.kommentar as form_kommentar, wf.score as form_score
      FROM produkt_wirkstoffe pw
      JOIN wirkstoffe w ON pw.wirkstoff_id = w.id
      LEFT JOIN wirkstoff_formen wf ON pw.form_id = wf.id
      WHERE pw.produkt_id = ?
      ORDER BY pw.ist_hauptwirkstoff DESC, wf.score DESC, w.name
    `).bind(produktId).all()

    const produktDetails: ProduktDetails = {
      ...produkt,
      wirkstoffe: wirkstoffeResult.results.map((w: any) => ({
        wirkstoff: {
          id: w.id,
          name: w.name,
          einheit: w.einheit,
          beschreibung: w.beschreibung,
          hypo_symptome: w.hypo_symptome,
          hyper_symptome: w.hyper_symptome,
          external_url: w.external_url,
          created_at: w.created_at,
          updated_at: w.updated_at
        },
        menge: w.menge,
        einheit: w.einheit,
        ist_hauptwirkstoff: w.ist_hauptwirkstoff,
        form: w.form_name ? {
          id: w.id,
          wirkstoff_id: w.id,
          name: w.form_name,
          kommentar: w.form_kommentar,
          score: w.form_score,
          created_at: w.created_at,
          tags: null
        } : undefined
      })),
      hauptwirkstoffe: wirkstoffeResult.results
        .filter((w: any) => w.ist_hauptwirkstoff)
        .map((w: any) => ({
          wirkstoff: {
            id: w.id,
            name: w.name,
            einheit: w.einheit,
            beschreibung: w.beschreibung,
            hypo_symptome: w.hypo_symptome,
            hyper_symptome: w.hyper_symptome,
            external_url: w.external_url,
            created_at: w.created_at,
            updated_at: w.updated_at
          },
          menge: w.menge,
          einheit: w.einheit,
          form: w.form_name ? {
            id: w.id,
            wirkstoff_id: w.id,
            name: w.form_name,
            kommentar: w.form_kommentar,
            score: w.form_score,
            created_at: w.created_at,
            tags: null
          } : undefined
        }))
    }

    // Preisberechnung
    const hauptwirkstoff = produktDetails.hauptwirkstoffe[0]
    if (hauptwirkstoff) {
      const tagesDosis = Math.max(1, Math.ceil(hauptwirkstoff.menge / 30))
      const preisProTag = (produkt.preis / produkt.einheit_anzahl) * tagesDosis
      produktDetails.preis_pro_tag = Math.round(preisProTag * 100) / 100
      produktDetails.preis_pro_monat = Math.round(preisProTag * 30 * 100) / 100
    }

    return c.json<ApiResponse<ProduktDetails>>({
      success: true,
      data: produktDetails
    })

  } catch (error) {
    console.error('Product detail error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden des Produkts'
    }, 500)
  }
})

// Produkt-Suche (allgemein)
produkte.get('/', optionalAuth, async (c) => {
  try {
    const query = c.req.query('q') || ''
    const wirkstoffId = c.req.query('wirkstoff_id')
    const marke = c.req.query('marke')
    const priceMin = c.req.query('price_min')
    const priceMax = c.req.query('price_max')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const offset = (page - 1) * limit

    let sqlQuery = `
      SELECT DISTINCT p.*, 
        GROUP_CONCAT(w.name, ', ') as hauptwirkstoffe_namen,
        MIN(p.preis / p.einheit_anzahl) as preis_pro_einheit
      FROM produkte p
      LEFT JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id AND pw.ist_hauptwirkstoff = 1
      LEFT JOIN wirkstoffe w ON pw.wirkstoff_id = w.id
      WHERE p.moderation_status = 'approved' AND p.sichtbarkeit = 1
    `

    const params: any[] = []

    if (query) {
      sqlQuery += ` AND (p.name LIKE ? OR p.marke LIKE ? OR w.name LIKE ?)`
      params.push(`%${query}%`, `%${query}%`, `%${query}%`)
    }

    if (wirkstoffId) {
      sqlQuery += ` AND pw.wirkstoff_id = ?`
      params.push(wirkstoffId)
    }

    if (marke) {
      sqlQuery += ` AND p.marke LIKE ?`
      params.push(`%${marke}%`)
    }

    if (priceMin) {
      sqlQuery += ` AND p.preis >= ?`
      params.push(priceMin)
    }

    if (priceMax) {
      sqlQuery += ` AND p.preis <= ?`
      params.push(priceMax)
    }

    sqlQuery += ` GROUP BY p.id ORDER BY p.name LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const produkteResult = await c.env.DB.prepare(sqlQuery).bind(...params).all()

    // Produkte mit präziser Dosierungsberechnung
    const produkteWithPricing = await Promise.all(
      produkteResult.results.map(async (produkt: any) => {
        let preis_pro_tag = 0
        let preis_pro_monat = 0
        let dosage_info = null
        
        // Intelligente Dosierungsberechnung
        dosage_info = calculateSimpleDosage(produkt)
        preis_pro_tag = dosage_info.preis_pro_tag
        preis_pro_monat = dosage_info.preis_pro_monat
        
        return {
          ...produkt,
          preis_pro_tag: Math.round(preis_pro_tag * 100) / 100,
          preis_pro_monat: Math.round(preis_pro_monat * 100) / 100,
          dosage_info
        }
      })
    )

    return c.json<ApiResponse>({
      success: true,
      data: produkteWithPricing
    })

  } catch (error) {
    console.error('Product search error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler bei der Produktsuche'
    }, 500)
  }
})

// Neues Produkt erstellen (User)
produkte.post('/', async (c) => {
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

    const body: CreateProduktRequest = await c.req.json()

    // Validierung
    if (!body.name || !body.preis || !body.wirkstoffe || body.wirkstoffe.length === 0) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Name, Preis und mindestens ein Wirkstoff sind erforderlich'
      }, 400)
    }

    // Mindestens ein Hauptwirkstoff erforderlich
    const hasHauptwirkstoff = body.wirkstoffe.some(w => w.ist_hauptwirkstoff)
    if (!hasHauptwirkstoff) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Mindestens ein Hauptwirkstoff ist erforderlich'
      }, 400)
    }

    // Produkt erstellen
    const produktResult = await c.env.DB.prepare(`
      INSERT INTO produkte (
        name, marke, form, preis, einheit_anzahl, einheit_text, 
        shop_link, bild_url, einreichung_user_id, moderation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      body.name,
      body.marke || null,
      body.form || null,
      body.preis,
      body.einheit_anzahl || 1,
      body.einheit_text || 'Stück',
      body.shop_link || null,
      body.bild_url || null,
      payload.userId
    ).run()

    const produktId = produktResult.meta.last_row_id as number

    // Wirkstoffe zuordnen
    for (const wirkstoff of body.wirkstoffe) {
      await c.env.DB.prepare(`
        INSERT INTO produkt_wirkstoffe (
          produkt_id, wirkstoff_id, ist_hauptwirkstoff, menge, einheit, form_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        produktId,
        wirkstoff.wirkstoff_id,
        wirkstoff.ist_hauptwirkstoff,
        wirkstoff.menge,
        wirkstoff.einheit || 'mg',
        wirkstoff.form_id || null
      ).run()
    }

    return c.json<ApiResponse<{ produkt_id: number }>>({
      success: true,
      data: { produkt_id: produktId },
      message: 'Produkt erfolgreich eingereicht. Es wird nach der Moderation freigeschaltet.'
    })

  } catch (error) {
    console.error('Create product error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Erstellen des Produkts'
    }, 500)
  }
})

export default produkte