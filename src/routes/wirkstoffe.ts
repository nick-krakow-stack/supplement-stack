import { Hono } from 'hono'
import type { CloudflareBindings, Wirkstoff, WirkstoffForm, WirkstoffSynonym, ApiResponse, SearchParams } from '../types'

const wirkstoffe = new Hono<{ Bindings: CloudflareBindings }>()

// Wirkstoff-Suche mit Autocomplete (inklusive Synonyme)
wirkstoffe.get('/search', async (c) => {
  try {
    const query = c.req.query('q') || ''
    const limit = parseInt(c.req.query('limit') || '10')

    if (!query || query.length < 2) {
      return c.json<ApiResponse<Wirkstoff[]>>({
        success: true,
        data: []
      })
    }

    // Suche in Wirkstoffen und Synonymen
    const searchResults = await c.env.DB.prepare(`
      SELECT DISTINCT 
        w.id, w.name, w.einheit, w.beschreibung, w.hypo_symptome, 
        w.hyper_symptome, w.external_url, w.created_at, w.updated_at,
        CASE 
          WHEN w.name LIKE ? THEN 3  -- Exakte Übereinstimmung am Anfang
          WHEN s.synonym LIKE ? THEN 2  -- Synonym-Match
          WHEN w.name LIKE ? THEN 1  -- Teilstring-Match
          ELSE 0 
        END as relevance_score
      FROM wirkstoffe w
      LEFT JOIN wirkstoff_synonyme s ON w.id = s.wirkstoff_id
      WHERE 
        w.name LIKE ? OR 
        s.synonym LIKE ?
      ORDER BY relevance_score DESC, w.name ASC
      LIMIT ?
    `).bind(
      `${query}%`,  // Für exakte Übereinstimmung am Anfang
      `${query}%`,  // Für Synonym-Match
      `%${query}%`, // Für Teilstring-Match
      `%${query}%`, // WHERE: Wirkstoff-Name
      `%${query}%`, // WHERE: Synonym
      limit
    ).all()

    const wirkstoffe = searchResults.results as Wirkstoff[]

    return c.json<ApiResponse<Wirkstoff[]>>({
      success: true,
      data: wirkstoffe
    })

  } catch (error) {
    console.error('Wirkstoff search error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler bei der Suche'
    }, 500)
  }
})

// Einzelnen Wirkstoff mit Details laden
wirkstoffe.get('/:id', async (c) => {
  try {
    const wirkstoffId = parseInt(c.req.param('id'))

    if (!wirkstoffId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültige Wirkstoff-ID'
      }, 400)
    }

    // Wirkstoff laden
    const wirkstoff = await c.env.DB.prepare(
      'SELECT * FROM wirkstoffe WHERE id = ?'
    ).bind(wirkstoffId).first() as Wirkstoff | null

    if (!wirkstoff) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Wirkstoff nicht gefunden'
      }, 404)
    }

    // Synonyme laden
    const synonymeResult = await c.env.DB.prepare(
      'SELECT * FROM wirkstoff_synonyme WHERE wirkstoff_id = ? ORDER BY synonym'
    ).bind(wirkstoffId).all()
    const synonyme = synonymeResult.results as WirkstoffSynonym[]

    // Formen laden
    const formenResult = await c.env.DB.prepare(
      'SELECT * FROM wirkstoff_formen WHERE wirkstoff_id = ? ORDER BY score DESC, name'
    ).bind(wirkstoffId).all()
    const formen = formenResult.results as WirkstoffForm[]

    // Empfohlene Produkte laden (für Modal 2)
    const empfohleneProdukte = await c.env.DB.prepare(`
      SELECT p.*, we.typ, we.reihenfolge, we.kommentar as empfehlung_kommentar,
        GROUP_CONCAT(
          w2.name || ': ' || pw.menge || ' ' || pw.einheit, 
          ' | '
        ) as wirkstoffe_info
      FROM produkte p
      JOIN wirkstoff_empfehlungen we ON p.id = we.produkt_id
      LEFT JOIN produkt_wirkstoffe pw ON p.id = pw.produkt_id
      LEFT JOIN wirkstoffe w2 ON pw.wirkstoff_id = w2.id
      WHERE we.wirkstoff_id = ? 
        AND p.moderation_status = 'approved' 
        AND p.sichtbarkeit = 1
      GROUP BY p.id, we.typ, we.reihenfolge, we.kommentar
      ORDER BY we.typ DESC, we.reihenfolge ASC
    `).bind(wirkstoffId).all()

    const wirkstoffDetails = {
      ...wirkstoff,
      synonyme,
      formen,
      empfohlene_produkte: empfohleneProdukte.results
    }

    return c.json<ApiResponse>({
      success: true,
      data: wirkstoffDetails
    })

  } catch (error) {
    console.error('Wirkstoff detail error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden des Wirkstoffs'
    }, 500)
  }
})

// Alle Wirkstoffe (für Admin)
wirkstoffe.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = (page - 1) * limit

    const wirkstoffeResult = await c.env.DB.prepare(`
      SELECT w.*, COUNT(p.id) as produkt_anzahl
      FROM wirkstoffe w
      LEFT JOIN produkt_wirkstoffe pw ON w.id = pw.wirkstoff_id
      LEFT JOIN produkte p ON pw.produkt_id = p.id AND p.moderation_status = 'approved'
      GROUP BY w.id
      ORDER BY w.name
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all()

    const totalResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM wirkstoffe'
    ).first() as { total: number }

    return c.json<ApiResponse>({
      success: true,
      data: {
        wirkstoffe: wirkstoffeResult.results,
        pagination: {
          page,
          limit,
          total: totalResult.total,
          pages: Math.ceil(totalResult.total / limit)
        }
      }
    })

  } catch (error) {
    console.error('Wirkstoffe list error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Wirkstoffe'
    }, 500)
  }
})

// Wirkstoff-Formen für ein bestimmten Wirkstoff
wirkstoffe.get('/:id/formen', async (c) => {
  try {
    const wirkstoffId = parseInt(c.req.param('id'))

    const formenResult = await c.env.DB.prepare(
      'SELECT * FROM wirkstoff_formen WHERE wirkstoff_id = ? ORDER BY score DESC, name'
    ).bind(wirkstoffId).all()

    return c.json<ApiResponse<WirkstoffForm[]>>({
      success: true,
      data: formenResult.results as WirkstoffForm[]
    })

  } catch (error) {
    console.error('Wirkstoff formen error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden der Formen'
    }, 500)
  }
})

// Häufigste Wirkstoffe (für Startseite/Demo)
wirkstoffe.get('/popular/top', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '8')

    const popularWirkstoffe = await c.env.DB.prepare(`
      SELECT w.*, COUNT(sp.id) as stack_usage,
        MIN(p.preis / p.einheit_anzahl) as min_preis_pro_einheit
      FROM wirkstoffe w
      LEFT JOIN produkt_wirkstoffe pw ON w.id = pw.wirkstoff_id AND pw.ist_hauptwirkstoff = 1
      LEFT JOIN produkte p ON pw.produkt_id = p.id AND p.moderation_status = 'approved'
      LEFT JOIN stack_produkte sp ON p.id = sp.produkt_id
      GROUP BY w.id
      HAVING COUNT(p.id) > 0
      ORDER BY stack_usage DESC, w.name
      LIMIT ?
    `).bind(limit).all()

    return c.json<ApiResponse>({
      success: true,
      data: popularWirkstoffe.results
    })

  } catch (error) {
    console.error('Popular wirkstoffe error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Laden beliebter Wirkstoffe'
    }, 500)
  }
})

export default wirkstoffe