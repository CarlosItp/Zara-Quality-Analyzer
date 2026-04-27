const express   = require('express');
const cors      = require('cors');
const dotenv    = require('dotenv');
const Anthropic = require('@anthropic-ai/sdk');
const puppeteer = require('puppeteer');
const https     = require('https');
const path      = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app  = express();
const PORT = 3000;

const apiKey     = (process.env.CLAUDE_API_KEY  || '').trim();
const serpApiKey = (process.env.SERPAPI_KEY      || '').trim();
const anthropic  = new Anthropic({ apiKey });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function fetchSerpImage(productName, code) {
  return new Promise((resolve) => {
    if (!serpApiKey) return resolve(null);

    const query = encodeURIComponent(`zara ${productName || code}`);
    const url   = `https://serpapi.com/search.json?engine=google_images&q=${query}&hl=es&gl=es&num=5&api_key=${serpApiKey}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json    = JSON.parse(data);
          const results = json.images_results || [];
          const zaraNet = results.find(r => r.original && r.original.includes('static.zara.net'));
          const zaraCom = results.find(r => r.original && r.original.includes('zara.com'));
          const best    = zaraNet || zaraCom || results[0];
          console.log(`[SerpApi] ${results.length} resultados, mejor: ${best ? best.original?.slice(0,70) : 'ninguno'}`);
          resolve(best ? best.original : null);
        } catch (e) {
          console.error('[SerpApi] Parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', (e) => {
      console.error('[SerpApi] Error:', e.message);
      resolve(null);
    });
  });
}

async function scrapeZara(code) {
  const result = { name: null, materials: [], productUrl: null, found: false };
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--lang=es-ES'],
    });

    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });
    await page.setViewport({ width: 1280, height: 900 });

    const searchUrl = `https://www.zara.com/es/es/search?searchTerm=${encodeURIComponent(code)}`;
    console.log('[Zara] Buscando:', code);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    const productHref = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="-p0"]')];
      return links.length ? links[0].href : null;
    });

    if (!productHref) {
      console.log('[Zara] Sin resultados');
      await browser.close();
      return result;
    }
    result.productUrl = productHref;

    await page.goto(productHref, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    result.name = await page.evaluate(() => {
      for (const s of ['h1.product-detail-info__header-name', 'h1[class*="name"]', 'h1']) {
        const el = document.querySelector(s);
        if (el && el.textContent.trim().length > 1) return el.textContent.trim();
      }
      return null;
    });

    await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, [role="button"], summary, .expandable-header, .accordion-header')];
      const btn = all.find(el => (el.textContent || '').toLowerCase().includes('composici'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    result.materials = await page.evaluate(() => {
      const re  = /algodón|algodon|lino|lana|seda|poliéster|poliester|viscosa|lyocell|modal|elastano|acrílico|acrilico|nailon|tencel|cupro|cachemir|mohair|alpaca/i;
      const set = new Set();

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim().replace(/\s+/g, ' ');
        if (/\d{1,3}\s*%/.test(t) && re.test(t) && t.length < 150) set.add(t);
      }

      if (set.size === 0) {
        document.body.innerText.split('\n').forEach(line => {
          const l = line.trim().replace(/\s+/g, ' ');
          if (/\d{1,3}\s*%/.test(l) && re.test(l) && l.length < 150) set.add(l);
        });
      }

      return [...set].slice(0, 8);
    });

    console.log(`[Zara] "${result.name}" | ${result.materials.join(' · ')}`);
    result.found = !!(result.name || result.materials.length > 0);
    await browser.close();
    return result;

  } catch (err) {
    console.error('[Zara] Error:', err.message);
    try { await browser.close(); } catch (_) {}
    return result;
  }
}

async function extractCodeFromImage(imageBase64, imageMime) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: 'Mira esta etiqueta de Zara. Extrae ÚNICAMENTE el código de referencia del producto (formato típico: XXXX/XXX/XXX o similar, suele estar junto a la talla como "5644/403/611/S"). Responde SOLO con el código numérico sin la talla (ej: "5644/403/611"). Si no ves ningún código, responde "null".' }
        ]
      }]
    });
    const txt = response.content[0].text.trim();
    if (txt === 'null' || txt.length < 4) return null;
    return txt.replace(/\/[A-Z]+$/, '').trim();
  } catch (e) {
    console.error('[ExtractCode]', e.message);
    return null;
  }
}

const SYSTEM_PROMPT = `Eres un experto en calidad textil especializado en Zara (Inditex). Analizas etiquetas de prendas Zara con precisión.

IDENTIFICACIÓN DEL COLOR DE ETIQUETA (MUY IMPORTANTE — lee con atención):
La etiqueta de MARCA (la del cuello con el logo ZARA) puede ser:
- NEGRA: fondo oscuro/negro con letras blancas o plateadas. Indica gama media-alta.
- BLANCA o GRIS CLARO: fondo blanco o claro con letras negras o grises. Indica gama básica/estándar.

Cuando dices "color de la etiqueta" te refieres al COLOR DE FONDO de la etiqueta, NO al color de las letras ni al color de la prenda.
Ejemplos:
- Etiqueta con fondo NEGRO y letras BLANCAS → "Prenda de etiqueta Negra" → labelType: negra_blanca
- Etiqueta con fondo BLANCO y letras NEGRAS → "Prenda de etiqueta Blanca" → labelType: blanca_negra
- Etiqueta con fondo BLANCO y letras GRISES → "Prenda de etiqueta Blanca" → labelType: blanca_gris

Sistema de etiquetado Zara:
- blanca_negra: fondo blanco + letras negras → Basics, producción masiva
- blanca_gris:  fondo blanco + letras grises → Colección estándar, calidad media
- negra_blanca: fondo negro + letras blancas → ZW Collection / Gama alta
- negra_negra:  fondo negro + letras negras/oscuras → Zara Studio / SRPLS, premium

Score (1-10):
- 9-10: 100% fibras nobles (seda, cachemira, lana virgen, lino puro)
- 7.5-9: >80% fibras naturales (algodón, lino, lana)
- 5.5-7.4: mezclas algodón + poliéster equilibradas
- 3-5.4: mayoría sintéticos (poliéster, acrílico, nailon)
- 1-3: casi todo sintético de baja calidad
Ajuste por etiqueta: negra/negra +2 | negra/blanca +1.5 | blanca/gris +0.5

REGLAS CRÍTICAS:
1. Etiqueta de composición blanca (fondo blanco, código de barras, referencia tipo "5644/403/611"): lee los porcentajes de materiales impresos.
2. Etiqueta de marca negra (fondo negro, logo ZARA grande, talla): gama media-alta, sin composición visible.
3. Etiqueta de marca blanca (fondo blanco o gris, logo ZARA, talla): gama básica, sin composición visible.
4. NUNCA confundas el color del tejido/prenda con el color de la etiqueta. Son cosas distintas.
5. NUNCA inventes materiales que no puedas leer claramente.

RESPONDE ÚNICAMENTE JSON PURO. Sin markdown. Sin texto extra.`;

function buildPrompt(zara, query, imageType, productFoundInStore) {
  const mats = zara.materials.length > 0 ? zara.materials.join(' | ') : null;
  const hasCode = query && query.trim().length > 1;

  let imgInstruction = '';
  if (imageType === 'brand') {
    imgInstruction = `IMAGEN ADJUNTA: etiqueta de marca del cuello de la prenda (la que tiene el logo ZARA grande).

INSTRUCCIÓN CLAVE — determina el COLOR DE FONDO de la etiqueta:
Fíjate únicamente en el fondo de la pequeña etiqueta cosida en el cuello, no en el tejido de la prenda.

Regla estricta:
- Fondo NEGRO o MUY OSCURO con letras blancas/plateadas → productName = "Prenda de etiqueta Negra", labelType = negra_blanca
- Fondo BLANCO o GRIS CLARO con letras negras o grises → productName = "Prenda de etiqueta Blanca", labelType = blanca_negra

NO confundas:
- El color del tejido/prenda (gris, azul, blanco...) con el color de la etiqueta del cuello
- Si la prenda es gris pero la etiqueta tiene fondo negro → es "Prenda de etiqueta Negra"
- Si la prenda es negra pero la etiqueta tiene fondo blanco → es "Prenda de etiqueta Blanca"

Etiqueta negra = gama media-alta. Etiqueta blanca = gama básica.
No hay composición visible — indica en description que para análisis completo se necesita la etiqueta de composición.`;
  } else if (imageType === 'composition') {
    imgInstruction = `IMAGEN ADJUNTA: etiqueta de composición con código de barras, referencia y materiales.
LEE los porcentajes de materiales exactamente como están impresos. Úsalos como fuente primaria absoluta.

INSTRUCCIÓN CLAVE — determina el COLOR DE FONDO de la etiqueta de composición:
La etiqueta de composición de Zara/Inditex es CASI SIEMPRE de fondo BLANCO con texto negro/oscuro.
Solo es negra si el fondo de toda la etiqueta es claramente negro o muy oscuro.

Regla estricta:
- Fondo BLANCO o CREMA (la gran mayoría): productName = "Prenda de etiqueta Blanca"
- Fondo NEGRO o MUY OSCURO (raro): productName = "Prenda de etiqueta Negra"

NO confundas:
- El color del código de barras (siempre negro) con el fondo de la etiqueta
- El color del texto impreso con el fondo de la etiqueta  
- El color del tejido/prenda que se ve alrededor con el fondo de la etiqueta
Fíjate únicamente en el FONDO de la etiqueta de papel/tela pequeña donde está impreso el código de barras.`;
  }

  const storeNote = productFoundInStore === false
    ? `IMPORTANTE: Este producto ya no está disponible en la tienda Zara actual. Pon imageUrl como null. NO asignes colección como "ZARA WOMAN", "ZARA MAN", "TRF" ni ninguna línea específica — pon collection como cadena vacía "".`
    : '';

  const noCollectionNote = (!productFoundInStore && imageType)
    ? `Como no hay datos de la tienda activa, el campo collection debe ser "" (vacío).`
    : '';

  return `Analiza esta prenda Zara${hasCode ? ` — código extraído: "${query}"` : ''}:

Datos de Zara.com: ${mats ? `Composición: ${mats}` : 'No encontrado en tienda actual'}
${zara.name ? `Nombre Zara.com: ${zara.name}` : ''}
${imgInstruction}
${storeNote}
${noCollectionNote}

Devuelve EXACTAMENTE este JSON (sin nada más):
{"productName":"nombre de la prenda","collection":"ZARA WOMAN|TRF|Basic|Studio|SRPLS|ZW Collection|HOMBRE|NIÑOS — o vacío si no hay datos","labelType":"blanca_negra|blanca_gris|negra_blanca|negra_negra","materials":["material XX%"],"score":6.5,"scoreExplanation":"justificación concisa max 12 palabras","description":"2-3 frases sobre tejido, calidad y uso recomendado.","imageUrl":null}`;
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { query = '', imageBase64, imageMime, imageType, image2Base64, image2Mime } = req.body;
    if (!apiKey)                return res.json({ error: 'CLAUDE_API_KEY no configurada en .env' });
    if (!query && !imageBase64) return res.json({ error: 'Proporciona un código o imagen.' });

    const compImage    = image2Base64 || (imageType === 'composition' ? imageBase64 : null);
    const compMime     = image2Base64 ? image2Mime : imageMime;
    const refImage     = image2Base64 ? imageBase64 : null; 

    let finalCode = query.trim();
    if (compImage && imageType === 'composition' && !finalCode) {
      console.log('[Analyze] Extrayendo código de la imagen...');
      const extracted = await extractCodeFromImage(refImage || compImage, refImage ? (image2Base64 ? imageMime : null) : compMime);
      if (extracted) {
        finalCode = extracted;
        console.log('[Analyze] Código extraído:', finalCode);
      }
    }

    const hasCode = finalCode.length > 1;

    const [zara, serpImage] = await Promise.all([
      hasCode ? scrapeZara(finalCode) : Promise.resolve({ name: null, materials: [], productUrl: null, found: false }),
      hasCode ? fetchSerpImage(null, finalCode) : Promise.resolve(null),
    ]);

    let imageUrl = serpImage;
    if (!imageUrl && zara.name && zara.found) {
      imageUrl = await fetchSerpImage(zara.name, finalCode);
    }

    const productFoundInStore = hasCode ? zara.found : null;

    if (!productFoundInStore && hasCode) {
      imageUrl = null; 
      console.log('[Analyze] Producto no encontrado en tienda — imagen bloqueada');
    }

    console.log(`[SerpApi] ${imageUrl ? imageUrl.slice(0,70)+'…' : 'no usada'}`);

    const content = [];
    if (refImage) {
      content.push({ type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: refImage } });
    }
    if (imageBase64 && !refImage) {
      content.push({ type: 'image', source: { type: 'base64', media_type: imageMime || 'image/jpeg', data: imageBase64 } });
    }
    if (compImage && compImage !== imageBase64) {
      content.push({ type: 'image', source: { type: 'base64', media_type: compMime || 'image/jpeg', data: compImage } });
    }
    content.push({ type: 'text', text: buildPrompt(zara, finalCode, imageType || null, productFoundInStore) });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5', 
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    let text = response.content[0].text.trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    if (zara.name && zara.found) parsed.productName = zara.name;

    if (imageUrl && productFoundInStore !== false) {
      parsed.imageUrl = imageUrl;
    } else if (!productFoundInStore && hasCode) {
      parsed.imageUrl = null;
      parsed.notInStore = true;
    }

    if (parsed.materials) {
      parsed.materials = [...new Map(parsed.materials.map(m => [m.toLowerCase().trim(), m])).values()];
    }

    res.json({ result: parsed });

  } catch (err) {
    console.error('[Error]', err.message);
    res.json({ error: err.message });
  }
});

process.on('uncaughtException',  err => console.error('[uncaughtException]', err.message));
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

app.listen(PORT, () => {
  console.log(`\n=============================================`);
  console.log(`👕  Zara Quality  →  http://localhost:${PORT}`);
  console.log(`🔑  Claude:   ${apiKey     ? 'CONECTADO' : 'SIN API KEY'}`);
  console.log(`🔎  SerpApi:  ${serpApiKey ? 'CONECTADO' : 'SIN API KEY'}`);
  console.log(`🌐  Puppeteer: activo`);
  console.log(`=============================================\n`);
});
