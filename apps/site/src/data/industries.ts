export interface Industry {
  slug: string;
  name: string;
  description: string;
  painPoints: string[];
  typicalDocTypes: string[];
  featuresNeeded: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export const allIndustries: Industry[] = [
  {
    slug: 'startups',
    name: 'Startups',
    description: 'Startups share pitch decks, financial models, and cap tables with dozens of investors. Forwarded decks leak strategy. CloakShare gives founders per-investor tracking, link expiry, and dynamic watermarks so you always know who viewed what.',
    painPoints: [
      'Pitch decks get forwarded to competitors without your knowledge',
      'No way to tell which investor actually opened your deck',
      'Cap table and financial model links stay active long after the round closes',
      'DocSend costs $65/user/month and still lacks video support',
    ],
    typicalDocTypes: ['Pitch decks', 'Financial models', 'Cap tables', 'Board updates', 'Product demos (video)'],
    featuresNeeded: ['Per-viewer tracking', 'Link expiry', 'Dynamic watermarks', 'Email gating', 'Page-level analytics', 'Video sharing'],
    faqs: [
      { question: 'Can I track which investors opened my pitch deck?', answer: 'Yes. CloakShare shows you exactly who opened your link, which pages they viewed, how long they spent on each page, and whether they returned for a second look. You get real-time webhook notifications when someone opens your deck.' },
      { question: 'How does CloakShare prevent pitch deck forwarding?', answer: 'Each link is unique and can be email-gated so only the intended recipient can view it. Dynamic watermarks overlay the viewer\'s email on every page, making any screenshot or screen recording traceable back to the source.' },
      { question: 'Is CloakShare cheaper than DocSend for startups?', answer: 'DocSend charges $65 per user per month. CloakShare starts free with 50 links and 500 views per month. The Growth plan at $99/month covers your entire team with no per-seat fees, saving a 5-person startup over $3,000 per year.' },
      { question: 'Can I share product demo videos alongside my pitch deck?', answer: 'Yes. CloakShare is the only platform that handles both documents and video in one place. Upload MP4, MOV, or WebM files and they are automatically transcoded to adaptive HLS streaming with watermarks and watch-time analytics.' },
    ],
  },
  {
    slug: 'law-firms',
    name: 'Law Firms',
    description: 'Law firms handle contracts, briefs, and discovery documents that demand strict access control. CloakShare provides email-gated links, audit trails, and dynamic watermarks to maintain attorney-client privilege and prevent unauthorized distribution.',
    painPoints: [
      'Sensitive case documents forwarded outside the intended recipient list',
      'No audit trail for who accessed which version of a contract',
      'Email attachments create uncontrolled copies that persist forever',
      'Existing secure sharing tools charge per-seat, making firm-wide rollout expensive',
    ],
    typicalDocTypes: ['Contracts', 'Legal briefs', 'Discovery documents', 'NDAs', 'Settlement agreements', 'Due diligence packages'],
    featuresNeeded: ['Email gating', 'Password protection', 'Audit trails', 'Link expiry', 'Dynamic watermarks', 'Custom domains'],
    faqs: [
      { question: 'Does CloakShare provide an audit trail for document access?', answer: 'Yes. Every view is logged with the viewer\'s email, IP address, timestamp, pages viewed, and time spent per page. You can export this data via API or webhooks for compliance records.' },
      { question: 'Can I restrict document access to specific email domains?', answer: 'Yes. You can restrict links to specific email addresses or entire domains (e.g., only @lawfirm.com addresses). Viewers must verify their email before accessing the document.' },
      { question: 'Is CloakShare compliant with legal data handling requirements?', answer: 'CloakShare is self-hostable, so you can run it on your own infrastructure to meet any data residency or compliance requirements. Documents are rendered server-side and never transmitted as raw files to the viewer.' },
      { question: 'How much does CloakShare cost for a law firm?', answer: 'CloakShare has no per-seat pricing. The Growth plan at $99/month covers your entire firm. Compare that to DocSend at $65/user/month, which costs $1,300/month for a 20-attorney practice.' },
    ],
  },
  {
    slug: 'real-estate',
    name: 'Real Estate',
    description: 'Real estate firms share property brochures, investment memos, and lease agreements with buyers, tenants, and investors. CloakShare tracks engagement to identify serious buyers and protects confidential deal terms from leaking to competitors.',
    painPoints: [
      'Property investment memos forwarded to competing buyers',
      'No visibility into which prospects actually reviewed listing materials',
      'Lease agreements and deal terms shared via email with no access control',
      'Video walkthroughs hosted on YouTube lack privacy and tracking',
    ],
    typicalDocTypes: ['Property brochures', 'Investment memos', 'Lease agreements', 'Offering memorandums', 'Video walkthroughs', 'Floor plans'],
    featuresNeeded: ['Per-viewer analytics', 'Video sharing', 'Link expiry', 'Email gating', 'Custom branding', 'Webhooks'],
    faqs: [
      { question: 'Can I share property walkthrough videos securely?', answer: 'Yes. Upload video walkthroughs in MP4, MOV, or WebM format. CloakShare transcodes them to adaptive HLS streaming with dynamic watermarks. You get watch-time analytics showing exactly how much each prospect viewed.' },
      { question: 'How do I know which buyers are serious?', answer: 'CloakShare shows per-viewer analytics including time spent on each page, return visits, and video watch completion. Prospects who spend 5 minutes on the financial projections page are more engaged than those who skim the cover.' },
      { question: 'Can I brand shared documents with my firm logo?', answer: 'Yes. Custom domains with auto-SSL let you share links from your own domain (e.g., docs.yourfirm.com). The viewing experience is fully white-labeled.' },
      { question: 'What happens when a deal closes?', answer: 'Set link expiry dates so access automatically revokes after a deal closes or an exclusivity period ends. No manual cleanup required.' },
    ],
  },
  {
    slug: 'architecture',
    name: 'Architecture Firms',
    description: 'Architecture firms share design presentations, project proposals, and construction documents with clients and contractors. CloakShare protects intellectual property with watermarks and provides engagement data to prioritize follow-ups on active proposals.',
    painPoints: [
      'Design presentations forwarded to competing firms during RFP processes',
      'No way to know if a client actually reviewed your proposal before the meeting',
      'Large presentation files bounce from email or get compressed and lose quality',
      'Construction documents shared via Dropbox have no access tracking',
    ],
    typicalDocTypes: ['Design presentations', 'Project proposals', 'Construction documents', 'Schematic designs', 'Rendering portfolios', '3D walkthrough videos'],
    featuresNeeded: ['Dynamic watermarks', 'Large file support', 'Video sharing', 'Page-level analytics', 'Link expiry', 'Custom domains'],
    faqs: [
      { question: 'Can I share large architecture presentations without file size limits?', answer: 'Yes. CloakShare converts documents server-side into a canvas-rendered viewer. The original file is never transmitted to the viewer, so file size does not affect the viewing experience. Upload PDFs, PPTX, and DOCX of any size.' },
      { question: 'How do I protect my design IP when sharing proposals?', answer: 'Dynamic watermarks overlay the viewer\'s email and a timestamp on every page. If a competitor screenshots your design, you can trace exactly who leaked it and when.' },
      { question: 'Can I share 3D walkthrough videos alongside my presentation?', answer: 'Yes. CloakShare handles both documents and video. Upload your walkthrough video and it is automatically transcoded to adaptive HLS streaming with per-viewer watermarks and watch-time analytics.' },
      { question: 'Will I know if the client reviewed my proposal before our meeting?', answer: 'Yes. Page-level analytics show exactly which sections the client viewed, how long they spent on each, and whether they returned for a second review. Webhooks can notify you in real time when the document is opened.' },
    ],
  },
  {
    slug: 'accounting',
    name: 'Accounting Firms',
    description: 'Accounting firms share tax returns, audit reports, and financial statements containing sensitive client data. CloakShare provides password-protected, expiring links with full audit trails to meet compliance requirements and protect client confidentiality.',
    painPoints: [
      'Tax returns and financial statements emailed as unprotected PDF attachments',
      'No way to revoke access after a client engagement ends',
      'Compliance audits require proof of who accessed which documents and when',
      'Per-seat pricing makes firm-wide adoption of secure sharing tools cost-prohibitive',
    ],
    typicalDocTypes: ['Tax returns', 'Audit reports', 'Financial statements', 'Engagement letters', 'Advisory reports', 'Compliance documentation'],
    featuresNeeded: ['Password protection', 'Link expiry', 'Audit trails', 'Email gating', 'Custom domains', 'Self-hosting'],
    faqs: [
      { question: 'Can CloakShare help with compliance audit requirements?', answer: 'Yes. Every document view is logged with viewer email, IP, timestamp, pages viewed, and time per page. Export audit logs via API for your compliance records. Self-hosting gives you full control over data retention policies.' },
      { question: 'How do I share tax returns securely with clients?', answer: 'Upload the PDF, create a link with email gating and password protection, set an expiry date, and share. The client verifies their email, enters the password, and views the document in a secure canvas-based viewer. No downloads, no forwarding.' },
      { question: 'Can I revoke access after an engagement ends?', answer: 'Yes. Disable any link instantly, or set automatic expiry dates when creating the link. Once expired or disabled, the document is no longer accessible.' },
      { question: 'Is CloakShare affordable for a mid-size accounting firm?', answer: 'CloakShare has no per-seat fees. The Growth plan at $99/month covers your entire firm. A 15-person firm saves over $11,000 per year compared to DocSend at $65/user/month.' },
    ],
  },
  {
    slug: 'recruiting',
    name: 'Recruiting & Staffing',
    description: 'Recruiters share candidate profiles, salary benchmarks, and client proposals with hiring managers. CloakShare tracks which candidates are being reviewed, prevents unauthorized sharing of compensation data, and provides engagement insights to prioritize follow-ups.',
    painPoints: [
      'Candidate profiles forwarded outside the hiring team without consent',
      'No insight into whether a hiring manager actually reviewed submitted candidates',
      'Salary benchmarks and fee agreements shared via email with no access control',
      'Video introductions hosted on generic platforms lack tracking and professionalism',
    ],
    typicalDocTypes: ['Candidate profiles', 'Salary benchmarks', 'Client proposals', 'Fee agreements', 'Video introductions', 'Market reports'],
    featuresNeeded: ['Per-viewer tracking', 'Video sharing', 'Email gating', 'Link expiry', 'Webhooks', 'Page-level analytics'],
    faqs: [
      { question: 'Can I share video introductions of candidates?', answer: 'Yes. Upload candidate video introductions in MP4, MOV, or WebM format. CloakShare transcodes them to HLS streaming with watermarks. Track exactly how much of each video the hiring manager watched.' },
      { question: 'How do I know if a hiring manager reviewed my candidates?', answer: 'Page-level analytics show which candidate profiles were viewed, time spent on each, and whether the manager returned for a second look. Real-time webhooks notify you the moment a document is opened.' },
      { question: 'Can I prevent hiring managers from forwarding candidate profiles?', answer: 'Yes. Email-gated links ensure only the intended recipient can view the profiles. Dynamic watermarks overlay the viewer\'s email on every page, deterring screenshots and making any leak traceable.' },
      { question: 'How does CloakShare pricing compare for recruiting firms?', answer: 'Most recruiters work in teams. CloakShare charges per account, not per seat. The Growth plan at $99/month covers your entire team. That is 85% cheaper than DocSend for a 10-person recruiting firm.' },
    ],
  },
  {
    slug: 'insurance',
    name: 'Insurance',
    description: 'Insurance agencies share policy documents, claims reports, and underwriting materials with clients and adjusters. CloakShare ensures sensitive policyholder data stays protected with email gating, expiry, and full audit trails for regulatory compliance.',
    painPoints: [
      'Policy documents with personal data shared as unencrypted email attachments',
      'Claims reports forwarded beyond authorized parties',
      'No audit trail for regulatory compliance when sharing underwriting materials',
      'Renewal documents stay accessible long after the policy period ends',
    ],
    typicalDocTypes: ['Policy documents', 'Claims reports', 'Underwriting materials', 'Renewal proposals', 'Coverage summaries', 'Loss run reports'],
    featuresNeeded: ['Email gating', 'Password protection', 'Link expiry', 'Audit trails', 'Self-hosting', 'Custom domains'],
    faqs: [
      { question: 'Does CloakShare help with insurance regulatory compliance?', answer: 'Yes. Full audit trails log every view with viewer identity, timestamp, and pages accessed. Self-hosting ensures policyholder data stays on your infrastructure. Link expiry automatically revokes access when policies end.' },
      { question: 'Can I share claims documents securely with adjusters?', answer: 'Yes. Create email-gated links restricted to specific adjuster email addresses. Add password protection for an extra layer of security. Every access is logged for your compliance records.' },
      { question: 'How do I ensure policy documents expire when coverage ends?', answer: 'Set link expiry dates aligned with policy periods. When the date passes, access is automatically revoked. No manual cleanup required.' },
      { question: 'Can I self-host CloakShare to meet data sovereignty requirements?', answer: 'Yes. CloakShare is open source and self-hostable via Docker. Run it on your own servers to meet any data residency, sovereignty, or regulatory requirements.' },
    ],
  },
  {
    slug: 'nonprofits',
    name: 'Nonprofits',
    description: 'Nonprofits share grant proposals, donor reports, and impact presentations with funders and board members. CloakShare provides free-tier access with tracking analytics that help organizations understand funder engagement and follow up strategically.',
    painPoints: [
      'Grant proposals forwarded to other organizations competing for the same funding',
      'No insight into whether a funder actually read your proposal or just opened it',
      'Board materials shared via email chains with no version control or access tracking',
      'Limited budgets make per-seat tools like DocSend impossible to justify',
    ],
    typicalDocTypes: ['Grant proposals', 'Donor reports', 'Impact presentations', 'Board packets', 'Annual reports', 'Program evaluation videos'],
    featuresNeeded: ['Page-level analytics', 'Free tier', 'Video sharing', 'Email gating', 'Link expiry', 'Webhooks'],
    faqs: [
      { question: 'Can a nonprofit use CloakShare for free?', answer: 'Yes. CloakShare\'s free tier includes 50 links and 500 views per month with page-level analytics, email gating, and watermarks. That is enough for most small to mid-size nonprofits to track grant proposals and donor engagement.' },
      { question: 'How do I track whether a funder read my grant proposal?', answer: 'Page-level analytics show exactly which sections the funder reviewed, how long they spent on each page, and whether they returned for a second look. You can configure webhooks to get notified the moment the proposal is opened.' },
      { question: 'Can I share impact videos with donors?', answer: 'Yes. Upload program videos in MP4, MOV, or WebM format. CloakShare transcodes them to adaptive HLS streaming with watch-time analytics so you know exactly how much each donor watched.' },
      { question: 'How do I prevent grant proposals from being forwarded?', answer: 'Email-gated links ensure only the intended funder can view your proposal. Dynamic watermarks overlay the viewer\'s email on every page, making any unauthorized sharing traceable.' },
    ],
  },
  {
    slug: 'franchise',
    name: 'Franchise Organizations',
    description: 'Franchise organizations share Franchise Disclosure Documents, operations manuals, and training materials with prospective and existing franchisees. CloakShare tracks who reviewed the FDD, ensures confidential materials stay controlled, and scales without per-seat fees.',
    painPoints: [
      'Franchise Disclosure Documents shared via email with no access tracking',
      'Operations manuals forwarded to unauthorized parties or competitors',
      'No way to confirm a prospective franchisee reviewed the FDD before signing',
      'Training materials need to be distributed to hundreds of franchisees affordably',
    ],
    typicalDocTypes: ['Franchise Disclosure Documents (FDD)', 'Operations manuals', 'Training materials', 'Brand guidelines', 'Marketing playbooks', 'Training videos'],
    featuresNeeded: ['Per-viewer tracking', 'Video sharing', 'Email gating', 'Link expiry', 'Audit trails', 'API integration'],
    faqs: [
      { question: 'Can I track whether a prospective franchisee read the FDD?', answer: 'Yes. CloakShare provides page-level analytics showing exactly which sections were viewed, time spent per page, and total completion percentage. This gives you documented proof of disclosure before signing.' },
      { question: 'How do I distribute training materials to hundreds of franchisees?', answer: 'Use the CloakShare API to automatically generate unique, tracked links for each franchisee. Integrate with your franchise management system. Webhooks notify you when materials are accessed.' },
      { question: 'Can I share training videos alongside manuals?', answer: 'Yes. CloakShare handles both documents and video in one platform. Upload training videos and they are transcoded to HLS streaming with per-viewer watermarks and completion tracking.' },
      { question: 'What does CloakShare cost for a franchise organization?', answer: 'CloakShare pricing is per account, not per franchisee. The Growth plan at $99/month covers unlimited team members. Scale from 10 to 500 franchisees without increasing your sharing tool costs.' },
    ],
  },
  {
    slug: 'consulting',
    name: 'Consulting Firms',
    description: 'Consulting firms share strategy decks, assessment reports, and project deliverables with clients. CloakShare protects proprietary frameworks and methodologies with watermarks while providing engagement data that reveals which recommendations clients prioritize.',
    painPoints: [
      'Strategy decks containing proprietary frameworks shared as unprotected PDFs',
      'No visibility into which sections of a deliverable the client actually reviewed',
      'Assessment reports forwarded internally at the client organization without consent',
      'Large teams make per-seat pricing prohibitively expensive',
    ],
    typicalDocTypes: ['Strategy decks', 'Assessment reports', 'Project deliverables', 'Proposals', 'Workshop presentations', 'Video presentations'],
    featuresNeeded: ['Dynamic watermarks', 'Page-level analytics', 'Video sharing', 'Custom domains', 'Email gating', 'Webhooks'],
    faqs: [
      { question: 'How do I protect proprietary consulting frameworks?', answer: 'Dynamic watermarks overlay the viewer\'s email and timestamp on every page of your strategy deck. Canvas-based rendering prevents right-click saving, downloading, or DOM extraction. Your IP is protected even when shared externally.' },
      { question: 'Can I see which recommendations a client focused on?', answer: 'Yes. Page-level analytics show exactly which sections received the most attention, how long the client spent on each recommendation, and which stakeholders viewed which parts of the deliverable.' },
      { question: 'Can I present video proposals to clients?', answer: 'Yes. Upload recorded presentations in MP4, MOV, or WebM format. CloakShare transcodes them to adaptive HLS streaming with dynamic watermarks and watch-time analytics.' },
      { question: 'How does pricing work for a large consulting team?', answer: 'CloakShare charges per account, not per consultant. The Growth plan at $99/month covers your entire team. A 25-person consulting firm saves over $19,000 per year compared to DocSend.' },
    ],
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    description: 'Healthcare organizations share patient education materials, clinical presentations, and compliance documents with strict privacy requirements. CloakShare provides self-hosted deployment, audit trails, and access controls that support HIPAA-compatible workflows.',
    painPoints: [
      'Patient education materials shared via generic links with no access control',
      'Clinical presentations containing PHI forwarded beyond intended recipients',
      'No audit trail for compliance documentation access',
      'Cloud-hosted sharing tools may not meet data residency requirements',
    ],
    typicalDocTypes: ['Patient education materials', 'Clinical presentations', 'Compliance documentation', 'Training materials', 'Research summaries', 'Educational videos'],
    featuresNeeded: ['Self-hosting', 'Audit trails', 'Email gating', 'Password protection', 'Link expiry', 'Video sharing'],
    faqs: [
      { question: 'Can CloakShare be self-hosted for healthcare compliance?', answer: 'Yes. CloakShare is open source and deployable via Docker on your own infrastructure. Self-hosting ensures all document data stays within your controlled environment, supporting HIPAA and other regulatory requirements.' },
      { question: 'Does CloakShare provide audit trails for compliance?', answer: 'Yes. Every view is logged with viewer identity, IP address, timestamp, pages accessed, and time per page. Export audit data via API for compliance records and incident response.' },
      { question: 'Can I share medical training videos securely?', answer: 'Yes. Upload training videos and CloakShare transcodes them to HLS streaming with per-viewer watermarks. Email gating and password protection ensure only authorized personnel can access the content.' },
      { question: 'How do I restrict document access to specific staff members?', answer: 'Use email gating to restrict access to specific email addresses or domains (e.g., @hospital.org). Add password protection for an additional security layer. Set link expiry to automatically revoke access.' },
    ],
  },
  {
    slug: 'education',
    name: 'Education',
    description: 'Educational institutions share course materials, research papers, and administrative documents with students, faculty, and accreditation bodies. CloakShare prevents unauthorized redistribution of course content while providing completion tracking for accountability.',
    painPoints: [
      'Course materials uploaded to shared drives and redistributed without permission',
      'No way to track whether students actually read assigned materials',
      'Research papers shared for peer review get forwarded prematurely',
      'Budget constraints make per-seat sharing tools impractical for departments',
    ],
    typicalDocTypes: ['Course materials', 'Research papers', 'Syllabi', 'Accreditation documents', 'Lecture recordings', 'Administrative reports'],
    featuresNeeded: ['Email gating', 'Completion tracking', 'Video sharing', 'Dynamic watermarks', 'Free tier', 'Link expiry'],
    faqs: [
      { question: 'Can I track whether students read assigned materials?', answer: 'Yes. Page-level analytics show exactly which pages each student viewed, how long they spent reading, and their overall completion percentage. Identify who engaged deeply versus who only skimmed the first page.' },
      { question: 'How do I prevent students from redistributing course content?', answer: 'Dynamic watermarks overlay each student\'s email on every page, making redistribution traceable. Canvas-based rendering prevents downloading or copy-pasting content. Email gating ensures only enrolled students can access materials.' },
      { question: 'Can I share lecture recordings securely?', answer: 'Yes. Upload lecture recordings in MP4, MOV, or WebM format. CloakShare transcodes them to adaptive HLS streaming with per-viewer watermarks and watch-time analytics showing completion rates per student.' },
      { question: 'Is CloakShare affordable for educational institutions?', answer: 'CloakShare offers a free tier with 50 links and 500 views per month. The Growth plan at $99/month covers an entire department with no per-seat fees. Self-hosting is also available at no cost for the open-source core.' },
    ],
  },
];

export function getIndustryBySlug(slug: string): Industry | undefined {
  return allIndustries.find((i) => i.slug === slug);
}

export function getIndustrySlugs(): string[] {
  return allIndustries.map((i) => i.slug);
}
