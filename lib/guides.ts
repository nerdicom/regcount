export type Guide = {
  slug: string; title: string; description: string; intro: string; readingTime: string;
  sections: { heading: string; paragraphs: string[]; items?: string[]; table?: { headers: string[]; rows: string[][] } }[];
  sources: { label: string; url: string }[];
};

export const guides: Guide[] = [
  {
    slug: 'domain-registration-count',
    title: 'What does a domain registration count tell you?',
    description: 'Understand exact-match domain registration counts, duplicate extensions, coverage gaps, and why registration breadth does not establish availability or value.',
    intro: 'An extension count can make a long domain list easier to understand. The useful part is knowing exactly what was counted—and what the number leaves out.',
    readingTime: '4 min read',
    sections: [
      { heading: 'Count one name across distinct extensions', paragraphs: [
        'In RegCount, a domain registration count means the number of distinct suffixes reported for the same exact name in a data source. It is different from the total number of domains registered in a registry, the number of websites using a word, or a count of people who own that name.',
        'For example, imagine a fictional dataset containing sampleword.com, sampleword.net, sampleword.co.uk, and sampleword.uk. That dataset has four distinct extensions for sampleword. This is an illustration of the counting rule, not a claim about those domains’ actual registrations.',
        'Repeated records for sampleword.com do not add another extension. A longer name such as getsampleword.com belongs to a separate exact-name result, even though it contains the same word.',
      ] },
      { heading: 'Separate exact matches from related names', paragraphs: [
        'An exact match keeps the name fixed while changing the extension. A related-name search allows extra text around the word. Both can help with research, but mixing them produces a number that is difficult to interpret.',
        'Before comparing two results, ask whether both are exact matches. A name with many longer variations can have a large related-name result set while appearing under relatively few extensions on its own.',
      ], table: { headers: ['Illustrative record', 'Where it belongs'], rows: [['sampleword.com', 'Exact-name group: sampleword'], ['sampleword.net', 'Same exact-name group; another extension'], ['getsampleword.com', 'A separate name containing sampleword'], ['samplewordlabs.com', 'A separate name containing sampleword']] } },
      { heading: 'Coverage changes the meaning of the total', paragraphs: [
        'A count describes the records available to the source at the time of the lookup. It does not prove that every registry and suffix has been checked. Different sources may cover different extensions or update on different schedules.',
        'This matters when you compare tools or repeat a search later. A change may reflect a registration, an expiry, a coverage change, or an update to the source. One isolated number does not tell you which explanation applies.',
        'For a reproducible comparison, record the exact input, the source, the lookup date, and the extension list. Keep these together when you export a result. If a result is marked as sample data, keep that label with the numbers.',
      ] },
      { heading: 'Registration, availability, and website activity answer different questions', paragraphs: [
        'A registration index asks whether a domain was recorded in its dataset. A registrar checks whether it can currently offer a particular domain for registration. A website visit shows what a web server returns. These checks are related, but they are not interchangeable.',
        'If a domain is absent from an index, its availability is still unknown. Likewise, a domain can exist without serving a public website. Registration-data lookup services can provide another way to investigate a specific domain; ICANN describes RDAP as a protocol for accessing registration data.',
      ] },
      { heading: 'Use the count to choose what to investigate next', paragraphs: [
        'An extension count is useful as a sorting signal: it can help you find names with a broader recorded presence and decide which results deserve a closer look. Then inspect the actual extensions and the context in which the name is used.',
        'Do not convert the count directly into a price, a traffic estimate, an owner count, or proof that a name is suitable for a business. Those questions require information the count does not contain. A thoughtful shortlist combines the number with the purpose of your research.',
      ], items: ['Check that the result is an exact match.', 'Read the source and sample/live label.', 'Inspect the extension list, not only the headline total.', 'Verify a specific domain separately before relying on its status.'] },
    ],
    sources: [{ label: 'ICANN: Registration Data Access Protocol', url: 'https://www.icann.org/rdap' }],
  },
  {
    slug: 'domain-extensions-explained',
    title: 'Domain extensions explained: TLDs, ccTLDs, and suffixes',
    description: 'Learn the difference between generic and country-code TLDs, how suffixes such as .co.uk are counted, and how to read a domain extension list.',
    intro: 'The ending of a domain looks simple until you compare .com, .uk, and .co.uk. Here is a practical way to read an extension list without mixing up its levels.',
    readingTime: '4 min read',
    sections: [
      { heading: 'Start at the right-hand end of the domain', paragraphs: [
        'A top-level domain, or TLD, is the final label in a domain name: com in example.com, or uk in example.co.uk. IANA maintains the root-zone database, which lists top-level domain delegations and their types.',
        'People also use “extension” to mean the ending under which a name is registered. That ending can contain more than one label. In everyday domain research, .co.uk is a useful suffix to distinguish from .uk, even though both end in the same top-level domain.',
        'RegCount presents the suffixes returned by its source. If the source reports a name under both .uk and .co.uk, they are two different extension entries. Counting only the final TLD would answer a different question and would collapse those entries into one.',
      ] },
      { heading: 'Generic and country-code TLDs describe categories', paragraphs: [
        'Generic TLDs include examples such as .com, .org, and .app. Country-code TLDs include .uk and .de. Some country-code extensions are also popular in naming contexts that are unrelated to geography.',
        'For example, IANA classifies .ai and .io as country-code TLDs. A name’s branding use does not change that classification. When comparing lists, distinguish the technical category from the audience you associate with an extension.',
      ], table: { headers: ['Example suffix', 'How to read it'], rows: [['.com', 'A generic top-level domain'], ['.app', 'A generic top-level domain'], ['.uk', 'A country-code top-level domain'], ['.ai / .io', 'Country-code TLDs, including when used for technology brands'], ['.co.uk', 'A multi-label suffix beneath the .uk TLD']] } },
      { heading: 'Read RegCount’s filters as a research aid', paragraphs: [
        'The current interface groups suffixes by a simple rule: a two-character final label is placed in the country-code group; other endings are placed in the generic group. This makes common extension lists easier to scan.',
        'That rule is not a complete registry taxonomy. It does not distinguish every sponsored, restricted, infrastructure, or internationalized extension category. Consult IANA’s root-zone records when an authoritative TLD classification matters.',
        'A filtered list is a view of the returned extensions, not a second registration count. If a result has twenty reported suffixes and a filter displays five, the filter has narrowed what you see. It has not changed the underlying result.',
      ] },
      { heading: 'Use the name you actually want to compare', paragraphs: [
        'The current RegCount input parser removes a URL wrapper, strips an initial www label, and compares the first remaining label. For example, entering https://www.cypress.com compares cypress.',
        'Enter the keyword directly if you want the clearest result. Do not enter a deeper subdomain such as shop.cypress.com when your intended keyword is cypress: the current parser would compare shop. This is a known input limitation, not a full public-suffix or subdomain parser.',
        'Internationalized names need their ASCII/Punycode representation in the current interface. Keep spelling and encoding consistent across a comparison so that a change in input is not mistaken for a difference in coverage.',
      ] },
      { heading: 'An extension list is a starting point', paragraphs: [
        'Use a list to identify the suffixes relevant to your research, then inspect particular domains separately. A short list may reflect a narrow source, and a long list does not establish how the domains are being used.',
        'The practical habit is to keep three things separate: the name you searched, the suffixes reported by the source, and the status you independently verified for a specific domain. That separation makes both single-name and bulk research easier to review later.',
      ] },
    ],
    sources: [{ label: 'IANA Root Zone Database', url: 'https://www.iana.org/domains/root/db' }],
  },
  {
    slug: 'compare-domain-names',
    title: 'How to compare domain names using extension counts',
    description: 'A practical bulk domain research workflow: clean your list, compare exact-name extension counts, inspect outliers, and keep useful CSV research notes.',
    intro: 'A good comparison keeps the inputs consistent and the conclusions modest. Use this workflow to turn a list of names into a shortlist you can investigate.',
    readingTime: '4 min read',
    sections: [
      { heading: '1. Decide what the comparison is for', paragraphs: [
        'Write down the question before sorting a list. Are you comparing names for a new project, reviewing an existing portfolio, or looking for words with a broad recorded presence? An extension count can help organize any of those tasks, but it cannot choose the objective for you.',
        'Choose a few criteria beyond the count. For a project shortlist, you might record spelling clarity, relevance to the project, and which extensions matter to the intended audience. Leave those judgments in separate columns instead of blending everything into an unexplained score.',
      ] },
      { heading: '2. Clean the inputs before you count', paragraphs: [
        'Use one underlying name per row. Keep an original-input column in your own notes if the starting list contains full domains. cypress.com and cypress.io normalize to the same keyword in RegCount, so they should not be treated as two independent names.',
        'The bulk tool accepts up to 50 input entries, separated by lines, spaces, commas, or semicolons. Normalized duplicates are combined. Remove duplicates before submission when they would push the input over the limit.',
        'Use the keyword directly rather than a subdomain. Review any invalid-input message before interpreting the results; a row the tool could not process has not been checked for registration.',
      ] },
      { heading: '3. Compare results from the same source and session', paragraphs: [
        'Start with a single batch so that the inputs receive the same treatment. Sort by extension count to find the names with the broadest reported coverage, then inspect the low-count and unknown rows too.',
        'Unknown is not zero. In RegCount’s sample mode, a name outside the sample collection has no verified count and appears without a number. Do not give that name a low rank on the assumption that no domains exist for it.',
        'The preview is useful for practicing the workflow, but its example counts are illustrative. For actual research, confirm that the response identifies a connected registration-data provider before drawing conclusions from the numbers.',
      ] },
      { heading: '4. Investigate differences in the extension mix', paragraphs: [
        'Two names can have the same total and very different extension lists. Open individual results and look for the suffixes relevant to the question you wrote down. A headline total should not hide that distinction.',
        'If a result surprises you, check the normalized keyword first. Then inspect the source label and the extension list. Possible causes include a different spelling, a multi-label suffix, incomplete coverage, or a source update. The comparison itself does not identify the cause.',
      ], table: { headers: ['What you see', 'What to check next'], rows: [['The same count for two names', 'Which extensions are actually present'], ['A missing count', 'Sample coverage, an invalid input, or a reported provider error'], ['One name appearing twice in your original list', 'Whether the inputs normalize to the same keyword'], ['A count that changed since your last export', 'Input, source, coverage, and lookup date']] } },
      { heading: '5. Export the result with enough context to revisit it', paragraphs: [
        'Download the comparison as CSV, then add your own research columns. RegCount exports the keyword, count, source, and any row note. Sample exports retain an explicit illustrative-data label.',
        'Record the lookup date in your research sheet and keep a copy of the inputs. For names on your shortlist, also save the relevant extension list from single-name search. This makes it easier to explain why you selected a name and to repeat the comparison later.',
        'Keep final decisions separate from the sorting step. Registration breadth does not establish a domain’s current availability, website traffic, or market value. Check the specific domain and the needs of your project before acting on the shortlist.',
      ], items: ['Original input and normalized keyword', 'Source and lookup date', 'Reported count and relevant suffixes', 'Independent checks and your next action'] },
    ],
    sources: [],
  },
];
