'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const XML_PATH = path.join(__dirname, '../../Zarplata_Perenos__ADRES_VIOEVA_AdresС января 2026 по 15.06.2026_new.xml');
const OUT_PATH = path.join(__dirname, '../js/data/ads-data.js');
const COUNT = 150;

/* ТЗ п.3.2: у первых 5 объявлений — разные ФИО для проверки быстрого поиска */
const SEARCH_TEST_APPLICANTS = [
  {
    fio: 'Петров Иван Николаевич',
    responseDate: '21.03.2026',
    mergedCount: 8,
    vacancyLink: 'https://nn.hh.ru/vacancy/118313701',
    resumeLink: 'https://nn.hh.ru/resume/013f0001'
  },
  {
    fio: 'Сидорова Мария Александровна',
    responseDate: '18.03.2026',
    mergedCount: 3,
    vacancyLink: 'https://nn.hh.ru/vacancy/118313712',
    resumeLink: 'https://nn.hh.ru/resume/013f0002'
  },
  {
    fio: 'Козлов Дмитрий Сергеевич',
    responseDate: '15.03.2026',
    mergedCount: 12,
    vacancyLink: 'https://nn.hh.ru/vacancy/118313723',
    resumeLink: 'https://nn.hh.ru/resume/013f0003'
  },
  {
    fio: 'Новикова Елена Викторовна',
    responseDate: '12.03.2026',
    mergedCount: 5,
    vacancyLink: 'https://nn.hh.ru/vacancy/118313734',
    resumeLink: 'https://nn.hh.ru/resume/013f0004'
  },
  {
    fio: 'Морозов Алексей Петрович',
    responseDate: '09.03.2026',
    mergedCount: 2,
    vacancyLink: 'https://nn.hh.ru/vacancy/118313745',
    resumeLink: 'https://nn.hh.ru/resume/013f0005'
  }
];

function readXml() {
  return execSync('iconv -f WINDOWS-1251 -t UTF-8 ' + JSON.stringify(XML_PATH), {
    maxBuffer: 256 * 1024 * 1024
  }).toString('utf8');
}

function tag(block, name) {
  const re = new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>', 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function tags(block, name) {
  const re = new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'gi');
  const out = [];
  let m;
  while ((m = re.exec(block)) !== null) out.push(m[1].trim());
  return out;
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9A-Fa-f]+);/g, function (_, hex) {
      return String.fromCodePoint(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function (_, num) {
      return String.fromCodePoint(parseInt(num, 10));
    });
}

function extractSectionHtml(html, title) {
  if (!html) return '';
  const re = new RegExp(
    '<b>\\s*' + title + '\\s*:</b>([\\s\\S]*?)(?=<b>\\s*(?:Обязанности|Требования|Условия)\\s*:</b>|$)',
    'i'
  );
  const m = String(html).match(re);
  if (!m) return '';
  const body = m[1].trim();
  if (!body) return '';
  return '<BR/><B>' + title + ':</B>' + body;
}

function htmlToPlainItems(html) {
  const decoded = decodeEntities(html);
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(decoded)) !== null) {
    const item = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/[\u25A0\u2666■□]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (item) items.push(item);
  }
  if (items.length) return items;
  const text = decoded
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u25A0\u2666■□]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? [text] : [];
}

function unixToRuDate(ts) {
  const n = Number(ts);
  if (!n) return '';
  const d = new Date(n * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = function (x) { return String(x).padStart(2, '0'); };
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
}

function unixToRuTime(ts) {
  const n = Number(ts);
  if (!n) return '';
  const d = new Date(n * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = function (x) { return String(x).padStart(2, '0'); };
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function buildAddress(block) {
  const parts = [];
  const index = tag(block, 'ADRESSORABOTI1-INDEX') || tag(block, 'ADRESSORABOTI-INDEX');
  const city = tag(block, 'ADRESSORABOTI1-GOROD') || tag(block, 'ADRESSORABOTI-GOROD');
  const streetType = tag(block, 'ADRESSORABOTI1-TIPULICA') || tag(block, 'ADRESSORABOTI-TIPULICA');
  const street = tag(block, 'ADRESSORABOTI1-ULICA') || tag(block, 'ADRESSORABOTI-ULICA');
  const house = tag(block, 'ADRESSORABOTI1-DOM') || tag(block, 'ADRESSORABOTI-DOM');
  if (index) parts.push(index);
  if (city) parts.push(city);
  if (street) parts.push((streetType ? streetType + ' ' : '') + street + (house ? ', ' + house : ''));
  return parts.join(', ');
}

function detectLegalForm(raw) {
  const name = String(raw || '').trim();
  if (/^ГБУЗ\s+НО/i.test(name)) return 'ГБУЗ НО';
  if (/^ООО/i.test(name)) return 'ООО';
  if (/^ПАО/i.test(name)) return 'ПАО';
  if (/^ЗАО/i.test(name)) return 'ЗАО';
  if (/^АО/i.test(name)) return 'АО';
  if (/^ИП/i.test(name)) return 'ИП';
  if (/^ГБУЗ/i.test(name)) return 'ГБУЗ';
  return '';
}

function detectAdType(block) {
  const paper = tag(block, 'REKLAMAGAZETA');
  if (paper) return 'ГАЗЕТА';
  if (tag(block, 'WEBSITEURL') || tag(block, 'WEBSITE')) return 'ИНТЕРНЕТ';
  return 'ГАЗЕТА';
}

function splitRows(xml) {
  const rows = [];
  const re = /<ROW>([\s\S]*?)<\/ROW>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (tag(m[1], 'VAKNAZV')) rows.push(m[1]);
    if (rows.length >= COUNT) break;
  }
  return rows;
}

function resolveApplicantFio(block, idx) {
  const fromXml = tag(block, 'FIO');
  if (fromXml) return fromXml;
  if (idx < SEARCH_TEST_APPLICANTS.length) return SEARCH_TEST_APPLICANTS[idx].fio;
  return '';
}

function buildMergedSources(test, dates) {
  if (!test || !test.mergedCount || Number(test.mergedCount) < 2) return null;
  const count = Math.min(Number(test.mergedCount), 3);
  const baseMatch = (test.vacancyLink || '').match(/(\d+)$/);
  const baseNum = baseMatch ? Number(baseMatch[1]) : 118313700;
  const days = ['30', '30', '26'];
  const suffixes = ['', '(ов)', '(ос)'];
  const sources = [];
  for (let i = 0; i < count; i += 1) {
    sources.push({
      link: 'https://nn.hh.ru/vacancy/' + (baseNum + i),
      suffix: suffixes[i] || '',
      date1: dates.date1,
      date2: dates.date2,
      date3: dates.date3,
      date4: dates.date4 || dates.date3 || dates.date2 || '',
      daysLeft: days[i] || dates.daysLeft || '30'
    });
  }
  return sources;
}

function resolveApplicantFields(block, idx, applicantFio) {
  const test = idx < SEARCH_TEST_APPLICANTS.length ? SEARCH_TEST_APPLICANTS[idx] : null;
  const xmlLink = tag(block, 'WEBSITEURL') || tag(block, 'WEBSITE');
  const mergedCountRaw = tag(block, 'KOLVOOTKL') || tag(block, 'KOLVOTKL') || tag(block, 'KOLVOTKLIK');
  let mergedCount = mergedCountRaw ? Number(mergedCountRaw) || mergedCountRaw : null;
  let responseDate = tag(block, 'DATAOTKL') || tag(block, 'DATAOTKLIKA') || '';
  let vacancyLink = xmlLink;
  let resumeLink = tag(block, 'REZUMEURL') || tag(block, 'RESUMEURL') || '';
  let link = xmlLink;

  if (applicantFio && test) {
    if (!responseDate) responseDate = test.responseDate;
    if (!mergedCount) mergedCount = test.mergedCount;
    if (!vacancyLink) vacancyLink = test.vacancyLink;
    if (!resumeLink) resumeLink = test.resumeLink;
    if (!link) link = vacancyLink;
  }

  return {
    responseDate: responseDate,
    mergedCount: applicantFio ? mergedCount : null,
    vacancyLink: vacancyLink,
    resumeLink: resumeLink,
    link: link,
    mergedLink: vacancyLink || link
  };
}

function rowToAd(block, idx) {
  const id = idx + 1;
  const phones = tags(block, 'TELEF_NOMER');
  const fullHtml = decodeEntities(tag(block, 'DOPINFORMS'));
  let dutiesHtml = decodeEntities(tag(block, 'DOPINFORMSOBYZANOSTI'));
  let reqHtml = decodeEntities(tag(block, 'DOPINFORMSTREBOVANIY'));
  let condHtml = decodeEntities(tag(block, 'DOPINFORMSUSLOVIY') || tag(block, 'DOPINFORMSUSLOVIYA'));
  if (!dutiesHtml && fullHtml) dutiesHtml = extractSectionHtml(fullHtml, 'Обязанности');
  if (!reqHtml && fullHtml) reqHtml = extractSectionHtml(fullHtml, 'Требования');
  /* Если DOPINFORMSUSLOVIY пуст — в «Условия» идёт весь DOPINFORMS (как в исходной вёрстке) */
  if (!condHtml && fullHtml) condHtml = fullHtml;
  const publOn = tag(block, 'PUBLON');
  const publOff = tag(block, 'PUBLOFF');
  const applicantFio = resolveApplicantFio(block, idx);
  const applicantFields = resolveApplicantFields(block, idx, applicantFio);
  const depubTime = unixToRuTime(publOff) || unixToRuTime(publOn);
  const date4 = (function () {
    const fact = tag(block, 'FACTDATE');
    if (!fact) return '';
    return unixToRuDate(fact) || fact;
  })();
  const testApplicant =
    idx < SEARCH_TEST_APPLICANTS.length ? SEARCH_TEST_APPLICANTS[idx] : null;
  const mergedSources = applicantFio
    ? buildMergedSources(testApplicant, {
        date1: unixToRuDate(publOn),
        date2: unixToRuDate(publOff),
        date3: unixToRuDate(publOff),
        date4: date4,
        depubTime: depubTime,
        daysLeft: tag(block, 'DNIDOOKONCHAN') || '30'
      })
    : null;

  return {
    id: id,
    phones: phones.length ? phones : [],
    email: tag(block, 'ELPOCHTA') || tag(block, 'ELPOCHTAKADROVIK'),
    status: tag(block, 'STATUS') || 'Активно',
    adType: detectAdType(block),
    vacancy: tag(block, 'VAKNAZV'),
    source: tag(block, 'REKLAMAGAZETA'),
    rubricNumber: tag(block, 'RUBRNOMER'),
    applicantFio: applicantFio,
    mergedCount: applicantFields.mergedCount,
    mergedLink: applicantFields.mergedLink,
    mergedSources: mergedSources,
    vacancyLink: applicantFields.vacancyLink,
    resumeLink: applicantFields.resumeLink,
    invoiceNumber: tag(block, 'SCHETNOMER'),
    invoiceDateRaw: tag(block, 'SCHETDATA'),
    inn: tag(block, 'INNKOMPAN'),
    companyRaw: tag(block, 'NAZVKOMPAN'),
    legalForm: detectLegalForm(tag(block, 'NAZVKOMPAN')),
    region: tag(block, 'ADRESSORABOTI1-OBLAST') || tag(block, 'ADRESSORABOTI-OBLAST'),
    city: tag(block, 'ADRESSORABOTI1-GOROD') || tag(block, 'ADRESSORABOTI-GOROD'),
    salary: tag(block, 'ZARPL') || tag(block, 'ZARPLSITE'),
    link: applicantFields.link,
    dutiesHtml: dutiesHtml,
    requirementsHtml: reqHtml,
    conditionsHtml: condHtml,
    dutiesPlain: htmlToPlainItems(dutiesHtml),
    requirementsPlain: htmlToPlainItems(reqHtml),
    conditionsPlain: htmlToPlainItems(condHtml),
    publishedDate: publOn ? unixToRuDate(publOn).split('.').reverse().join('-') : '',
    timeLabel: tag(block, 'VREMYARABOTY1') || '',
    publOnRaw: publOn,
    publOffRaw: publOff,
    depubTime: depubTime,
    daysLeft: tag(block, 'DNIDOOKONCHAN') || '30',
    date1: unixToRuDate(publOn),
    date2: unixToRuDate(publOff),
    date3: unixToRuDate(publOff),
    date4: date4,
    date5: tag(block, 'DEPUBDATE') ? unixToRuDate(tag(block, 'DEPUBDATE')) || tag(block, 'DEPUBDATE') : '',
    responseDate: applicantFields.responseDate,
    address: buildAddress(block),
    xmlFile: path.basename(XML_PATH)
  };
}

const xml = readXml();
const rows = splitRows(xml);
if (rows.length < COUNT) {
  console.warn('Only found', rows.length, 'rows, expected', COUNT);
}

const ads = rows.slice(0, COUNT).map(rowToAd);
const body = 'window.ADS_DATA = ' + JSON.stringify(ads, null, 2) + ';\n';
fs.writeFileSync(OUT_PATH, body);
console.log('Wrote', ads.length, 'ads to', OUT_PATH);
console.log('Unique vacancies:', new Set(ads.map(function (a) { return a.vacancy; })).size);
console.log('Unique duties (first line):', new Set(ads.map(function (a) { return (a.dutiesPlain[0] || a.vacancy); })).size);
console.log('With FIO:', ads.filter(function (a) { return a.applicantFio; }).length);
