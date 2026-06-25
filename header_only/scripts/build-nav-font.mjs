import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFonts } from 'fantasticon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../icons/nav');
const TMP = path.join(__dirname, '../icons/nav-font-src');
const OUT = path.join(__dirname, '../fonts');

const pairs = [
  ['resume.svg', 'resume'],
  ['resume.svg', 'resume-hover'],
  ['managers.svg', 'managers'],
  ['managers.svg', 'managers-hover'],
  ['letters.svg', 'letters'],
  ['letters.svg', 'letters-hover'],
  ['import.svg', 'import'],
  ['import.svg', 'import-hover'],
  ['companies.svg', 'companies'],
  ['companies.svg', 'companies-hover'],
  ['ads.svg', 'ads'],
  ['ads.svg', 'ads-hover']
];

const codepoints = {
  resume: 0xf103,
  'resume-hover': 0xf104,
  managers: 0xf105,
  'managers-hover': 0xf106,
  letters: 0xf107,
  'letters-hover': 0xf108,
  import: 0xf109,
  'import-hover': 0xf10a,
  companies: 0xf10b,
  'companies-hover': 0xf10c,
  ads: 0xf10d,
  'ads-hover': 0xf10e
};

fs.mkdirSync(TMP, { recursive: true });
pairs.forEach(function (pair) {
  fs.copyFileSync(path.join(SRC, pair[0]), path.join(TMP, pair[1] + '.svg'));
});

await generateFonts({
  name: 'vsevn-nav-icons',
  inputDir: TMP,
  outputDir: OUT,
  fontTypes: ['woff2', 'woff'],
  assetTypes: [],
  normalize: true,
  fontHeight: 1000,
  descent: 200,
  codepoints: codepoints
});

console.log('Built vsevn-nav-icons.woff2/.woff in', OUT);
