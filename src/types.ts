import * as BibTeXParser from '@retorquere/bibtex-parser';
import { Entry as EntryDataBibLaTeX } from '@retorquere/bibtex-parser';
// Also make EntryDataBibLaTeX available to other modules
export { Entry as EntryDataBibLaTeX } from '@retorquere/bibtex-parser';

// Trick: allow string indexing onto object properties
export interface IIndexable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const databaseTypes = ['csl-json', 'biblatex'] as const;
export type DatabaseType = typeof databaseTypes[number];

export const TEMPLATE_VARIABLES = {
  abstract: '',
  authEtAl:
    'Name format is "Smith, J." (> 2 authors are abbreviated to et al.)',
  authorString: 'Comma-separated list of author names',
  citekey: 'Unique citekey',
  containerTitle:
    'Title of the container holding the reference (e.g. book title for a book chapter, or the journal title for a journal article)',
  creatorEtAl: 'just like authEtAl but based on the creator field',
  DOI: '',
  eprint: '',
  eprinttype: '',
  eventPlace: 'Location of event',
  keywords: '',
  note: '',
  page: 'Page or page range',
  publisher: '',
  publisherPlace: 'Location of publisher',
  title: '',
  type: 'Zotero item type (e.g. article, book, etc.)',
  URL: '',
  year: 'Publication year',
  zoteroSelectURI: 'URI to open the reference in Zotero',
  bibAPA:
    '(dont use at the moment, its not complete) Prebuilt APA-style bibliography',
  inlineAPA:
    '(dont use at the moment, its not complete) Prebuilt APA-style in-text reference',
  issueDateLong: '(BibLaTeX only) Date of publication (e.g. 2020, May 20)',
  domain: '(BibLaTeX only) Domain of the URL (e.g. example.com)',
};

export class Library {
  constructor(public entries: { [citekey: string]: Entry }) {}

  get size(): number {
    return Object.keys(this.entries).length;
  }
  /**
   * For the given citekey, find the corresponding `Entry` and return a
   * collection of template variable assignments.
   */
  getTemplateVariablesForCitekey(citekey: string): Record<string, any> {
    const entry: Entry = this.entries[citekey];
    const shortcuts = {
      citekey: citekey,

      type: entry.type,
      keywords: entry.keywords,
      keywordsString: entry.keywordsString,
      authEtAl: entry.authEtAl,
      bibAPA: entry.bibAPA,
      inlineAPA: entry.inlineAPA,
      accessDate: entry.accessDate,
      creatorEtAl: entry.creatorEtAl,
      issueDateLong: entry.issueDateLong,

      abstract: entry.abstract,
      authorString: entry.authorString,
      containerTitle: entry.containerTitle,
      DOI: entry.DOI,
      eprint: entry.eprint,
      eprinttype: entry.eprinttype,
      eventPlace: entry.eventPlace,
      note: entry.note,
      page: entry.page,
      publisher: entry.publisher,
      publisherPlace: entry.publisherPlace,
      title: entry.title,
      URL: entry.URL,
      year: entry.year?.toString(),
      zoteroSelectURI: entry.zoteroSelectURI,
    };

    return { entry: entry.toJSON(), ...shortcuts };
  }
}

/**
 * Load reference entries from the given raw database data.
 *
 * Returns a list of `EntryData`, which should be wrapped with the relevant
 * adapter and used to instantiate a `Library`.
 */
export function loadEntries(
  databaseRaw: string,
  databaseType: DatabaseType,
): EntryData[] {
  let libraryArray: EntryData[];

  if (databaseType == 'csl-json') {
    libraryArray = JSON.parse(databaseRaw);
  } else if (databaseType == 'biblatex') {
    const options: BibTeXParser.ParserOptions = {
      errorHandler: (err) => {
        console.warn('Citation plugin: error loading BibLaTeX entry:', err);
      },
    };
    const parsed = BibTeXParser.parse(
      databaseRaw,
      options,
    ) as BibTeXParser.Bibliography;
    libraryArray = parsed.entries;
  }

  return libraryArray;
}

export interface Author {
  given?: string;
  family?: string;
}

/**
 * An `Entry` represents a single reference in a reference database.
 * Each entry has a unique identifier, known in most reference managers as its
 * "citekey."
 */
export abstract class Entry {
  /**
   * Unique identifier for the entry (also the citekey).
   */
  public abstract id: string;

  public abstract type: string;

  public abstract abstract?: string;
  public abstract author?: Author[];
  public abstract keywords?: string[];

  /**
   * A comma-separated list of authors, each of the format `<firstname> <lastname>`.
   */
  public abstract authorString?: string;
  public abstract keywordsString?: string;

  /**
   * The name of the container for this reference -- in the case of a book
   * chapter reference, the name of the book; in the case of a journal article,
   * the name of the journal.
   */
  public abstract containerTitle?: string;

  public abstract DOI?: string;
  public abstract files?: string[];

  /**
   * The date of issue. Many references do not contain information about month
   * and day of issue; in this case, the `issuedDate` will contain dummy minimum
   * values for those elements. (A reference which is only encoded as being
   * issued in 2001 is represented here with a date 2001-01-01 00:00:00 UTC.)
   */
  public abstract issuedDate?: Date;

  /**
   * Page or page range of the reference.
   */
  public abstract page?: string;
  public abstract title?: string;
  public abstract URL?: string;

  public abstract eventPlace?: string;

  public abstract publisher?: string;
  public abstract publisherPlace?: string;

  /**
   * BibLaTeX-specific properties
   */
  public abstract eprint?: string;
  public abstract eprinttype?: string;

  protected _year?: string;
  public get year(): number {
    return this._year
      ? parseInt(this._year)
      : this.issuedDate?.getUTCFullYear();
  }

  public abstract accessDate?: string;
  public abstract creatorEtAl?: string;
  public abstract issueDateLong?: string;
  protected _note?: string[];

  public get note(): string {
    return this._note
      ?.map((el) => el.replace(/(zotero:\/\/.+)/g, '[Link]($1)'))
      .join('\n\n');
  }

  /**
   * A URI which will open the relevant entry in the Zotero client.
   */
  public get zoteroSelectURI(): string {
    return `zotero://select/items/@${this.id}`;
  }

  public abstract bibAPA?: string;
  public abstract inlineAPA?: string;

  public get authEtAl(): string {
    if (this.author) {
      let authEtAl = '';
      let cutAfter = 3;

      if (cutAfter > this.author?.length) {
        cutAfter = this.author?.length;
      }

      for (let i = 0; i < cutAfter; i++) {
        if (this.author[i].family != undefined) {
          if (i > 0) {
            authEtAl += ', ';
            if (i == cutAfter - 1 && this.author.length <= cutAfter) {
              authEtAl += '& ';
            }
          }
          authEtAl += this.author[i].family;
          if (
            this.author[i].given != undefined &&
            this.author.length <= cutAfter
          ) {
            authEtAl += ', ' + this.author[i].given.charAt(0) + '.';
          }
        }
      }
      if (this.author.length > cutAfter) {
        authEtAl += ' et al.';
      }
      return authEtAl;
    }
  }

  toJSON(): Record<string, unknown> {
    const jsonObj: Record<string, unknown> = Object.assign({}, this);

    // add getter values
    const proto = Object.getPrototypeOf(this);
    Object.entries(Object.getOwnPropertyDescriptors(proto))
      .filter(([, descriptor]) => typeof descriptor.get == 'function')
      .forEach(([key, descriptor]) => {
        if (descriptor && key[0] !== '_') {
          try {
            const val = (this as IIndexable)[key];
            jsonObj[key] = val;
          } catch (error) {
            return;
          }
        }
      });

    return jsonObj;
  }
}

export type EntryData = EntryDataCSL | EntryDataBibLaTeX;

export interface EntryDataCSL {
  id: string;
  type: string;
  abstract?: string;
  author?: Author[];
  keywords?: string[];
  keywordsString?: string;
  'container-title'?: string;
  DOI?: string;
  'event-place'?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  issued?: { 'date-parts': [any[]] };
  page?: string;
  publisher?: string;
  'publisher-place'?: string;
  title?: string;
  URL?: string;
}

export class EntryCSLAdapter extends Entry {
  public citeBibliographyType: string;
  constructor(private data: EntryDataCSL) {
    super();
  }

  eprint: string = null;
  eprinttype: string = null;
  files: string[] = null;
  bibAPA: string = null;
  inlineAPA: string = null;
  accessDate: string = null;
  creatorEtAl: string = null;
  issueDateLong: string = null;

  get id() {
    return this.data.id;
  }
  get type() {
    return this.data.type;
  }

  get abstract() {
    return this.data.abstract;
  }
  get author() {
    return this.data.author;
  }

  get authorString(): string | null {
    return this.data.author
      ? this.data.author.map((a) => `${a.given} ${a.family}`).join(', ')
      : null;
  }

  get keywords() {
    return this.data.keywords;
  }

  get keywordsString(): string | null {
    // addQuotes then join
    return this.data.keywords
      ? this.data.keywords.map((k) => `[['${k}']]`).join(', ')
      : null;
  }

  get containerTitle() {
    return this.data['container-title'];
  }

  get DOI() {
    return this.data.DOI;
  }

  get eventPlace() {
    return this.data['event-place'];
  }

  get issuedDate() {
    if (
      !(
        this.data.issued &&
        this.data.issued['date-parts'] &&
        this.data.issued['date-parts'][0].length > 0
      )
    )
      return null;

    const [year, month, day] = this.data.issued['date-parts'][0];
    return new Date(year, (month || 1) - 1, day || 1);
  }

  get page() {
    return this.data.page;
  }

  get publisher() {
    return this.data.publisher;
  }

  get publisherPlace() {
    return this.data['publisher-place'];
  }

  get title() {
    return this.data.title;
  }

  get URL() {
    return this.data.URL;
  }
}

const BIBLATEX_PROPERTY_MAPPING: Record<string, string> = {
  abstract: 'abstract',
  booktitle: '_containerTitle',
  date: 'issued',
  doi: 'DOI',
  eprint: 'eprint',
  eprinttype: 'eprinttype',
  eventtitle: 'event',
  journal: '_containerTitle',
  journaltitle: '_containerTitle',
  location: 'publisherPlace',
  pages: 'page',
  shortjournal: 'containerTitleShort',
  title: 'title',
  shorttitle: 'titleShort',
  url: 'URL',
  venue: 'eventPlace',
  year: '_year',
  publisher: 'publisher',
  note: '_note',

  keywords: 'keywords',
  keywordsString: 'keywordsString',
  domain: 'domain',
  authEtAl: 'authEtAl',
  bibAPA: 'bibAPA',
};

// BibLaTeX parser returns arrays of property values (allowing for repeated
// property entries). For the following fields, just blindly take the first.
const BIBLATEX_PROPERTY_TAKE_FIRST: string[] = [
  'abstract',
  'booktitle',
  '_containerTitle',
  'date',
  'doi',
  'eprint',
  'eprinttype',
  'eventtitle',
  'journaltitle',
  'location',
  'pages',
  'shortjournal',
  'title',
  'shorttitle',
  'url',
  'venue',
  '_year',
  'publisher',
];

export class EntryBibLaTeXAdapter extends Entry {
  abstract?: string;
  _containerTitle?: string;
  containerTitleShort?: string;
  DOI?: string;
  eprint?: string;
  eprinttype?: string;
  event?: string;
  eventPlace?: string;
  issued?: string;
  page?: string;
  publisher?: string;
  publisherPlace?: string;
  title?: string;
  titleShort?: string;
  URL?: string;
  _year?: string;
  _note?: string[];
  keywords?: string[];

  constructor(private data: EntryDataBibLaTeX) {
    super();

    Object.entries(BIBLATEX_PROPERTY_MAPPING).forEach(
      (map: [string, string]) => {
        const [src, tgt] = map;
        if (src in this.data.fields) {
          let val = this.data.fields[src];
          if (BIBLATEX_PROPERTY_TAKE_FIRST.includes(src)) {
            val = (val as any[])[0];
          }

          (this as IIndexable)[tgt] = val;
        }
      },
    );
  }

  get id() {
    return this.data.key;
  }
  get type() {
    return this.data.type;
  }

  get files(): string[] {
    // For some reason the bibtex parser doesn't reliably parse file list to
    // array ; so we'll do it manually / redundantly
    let ret: string[] = [];
    if (this.data.fields.file) {
      ret = ret.concat(this.data.fields.file.flatMap((x) => x.split(';')));
    }
    if (this.data.fields.files) {
      ret = ret.concat(this.data.fields.files.flatMap((x) => x.split(';')));
    }

    return ret;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  get accessDate(): string | null {
    if (this.data.fields.urldate) {
      return this.data.fields.urldate[0];
    }
  }

  get keywordsString() {
    return this.keywords
      ? this.keywords.map((k) => `- [[${k}]]`).join('\n')
      : null;
  }

  get authorString() {
    if (Object.values(this.data.creators).length > 0) {
      const names = Object.values(this.data.creators)[0].map((name) => {
        if (name.literal) return name.literal;
        const parts = [name.firstName, name.prefix, name.lastName, name.suffix];
        // Drop any null parts and join
        return parts.filter((x) => x).join(' ');
      });

      return names.join(', ');
    } else {
      return this.data.fields.author?.join(', ');
    }
  }

  get containerTitle() {
    if (this._containerTitle) {
      return this._containerTitle;
    } else if (this.data.fields.eprint) {
      const prefix = this.data.fields.eprinttype
        ? `${this.data.fields.eprinttype}:`
        : '';
      const suffix = this.data.fields.primaryclass
        ? ` [${this.data.fields.primaryclass}]`
        : '';
      return `${prefix}${this.data.fields.eprint}${suffix}`;
    }
  }

  get issuedDate() {
    return this.issued ? new Date(this.issued) : null;
  }

  get author(): Author[] {
    return Object.values(this.data.creators)[0]?.map((a) => ({
      given: a.firstName,
      family: a.lastName,
    }));
  }

  public get domain(): string {
    let domain = '';
    if (this.URL) {
      domain = new URL(this.URL).hostname.replace(/^www\./, '');
    }
    this.capitalize(domain);
    return this.capitalize(domain).split('.')[0];
  }

  public get bibAPA(): string {
    return this.createBibAPA(this);
  }

  public get inlineAPA(): string {
    return this.createInlineAPA(this);
  }

  // returning different string based on the type of the entry
  createBibAPA(entry: Entry) {
    switch (entry.type) {
      case 'video':
        return this.createBib(entry);
      case 'book':
        return this.createBib(entry);
      case 'inreference':
        return this.createBibInReference(entry);
      case 'online':
        return this.createBib(entry);
      case 'incollection':
        return this.createBibInCollection(entry);
      default:
        return entry.type;
    }
  }

  createInlineAPA(entry: Entry) {
    switch (entry.type) {
      case 'video':
        return this.createInline(entry);
      case 'book':
        return this.createInline(entry);
      case 'inreference':
        return this.createInlineInReference(entry);
      case 'online':
        return this.createInline(entry);
      case 'incollection':
        return this.createInline(entry);
      default:
        return entry.type;
    }
  }

  createBibInCollection(entry: Entry) {
    return `${this.creatorEtAl} (${entry.issuedDate?.getFullYear()}). ${
      entry.title
    }. In ${entry.containerTitle + this.addBrackets(this.getPages())}. ${
      entry.publisher
    }. ${entry.publisherPlace} . ${entry.DOI ? `DOI: ${entry.DOI}` : ''}`;
  }

  getPages(): string {
    if (this.page) {
      // if includes non-numeric characters, assume its a range of pages
      if (this.page.match(/[^0-9]/)) {
        return `pp. ${this.page}`;
      } else {
        return `p. ${this.page}`;
      }
    }
    return '';
  }

  addBrackets(str: string) {
    return `(${str})`;
  }

  createBibInReference(entry: Entry) {
    return (
      this.creatorEtAl +
      ' (' +
      this.issueDateLong +
      '). ' +
      entry.title +
      '. In ' +
      entry.containerTitle +
      '. ' +
      entry.URL
    );
  }

  createInlineInReference(entry: Entry) {
    return (
      '("' +
      entry.containerTitle +
      '", ' +
      entry.issuedDate.getUTCFullYear() +
      ')'
    );
  }

  createBib(entry: Entry) {
    return (
      this.creatorEtAl +
      ' (' +
      this.issueDateLong +
      '). ' +
      entry.title +
      ' [' +
      this.capitalize(entry.type) +
      ']. ' +
      this.capitalize(this.domain) +
      '. ' +
      entry.URL
    );
  }

  createInline(entry: Entry): string {
    let c = '';
    if (entry.page) c = ', ';
    return `(${this.creatorEtAl}, ${entry.issuedDate.getUTCFullYear()}${
      c + this.getPages()
    })`;
  }

  // Capitalize the first letter the string
  capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  get issueDateLong(): string {
    return (
      this.issuedDate?.getUTCFullYear() +
      ', ' +
      this.issuedDate?.toLocaleString('en', {
        month: 'long',
        day: '2-digit',
      })
    );
  }

  public get creatorEtAl() {
    let creatorEtAl = '';
    let counter = 0;
    let totalCreators = 0;

    const cutAfter = 2;
    const creators = Object.values(this.data.creators);

    if (creators.length > 0) {
      for (const creatorType of creators) {
        totalCreators += creatorType.length;
      }

      if (totalCreators > 0) {
        // looping through the different creator types
        for (let i = 0; i < creators.length; i++) {
          if (counter >= cutAfter) break;
          if (i > 0) creatorEtAl += ', ';

          const names = creators[i].map((name) => {
            counter++;

            if (counter > cutAfter) return 'et al.';
            if (name.literal) return name.literal;
            if (totalCreators > cutAfter) return name.lastName;
            const parts = [name.lastName, name.firstName.charAt(0) + '.'];
            return parts.filter((x) => x).join(' ');
          });

          if (
            totalCreators > 1 &&
            counter == totalCreators &&
            totalCreators <= cutAfter
          ) {
            names[names.length - 1] = '& ' + names[names.length - 1];
          }
          creatorEtAl += names.join(', ');
        }
      }
    }

    return creatorEtAl;
  }
}
