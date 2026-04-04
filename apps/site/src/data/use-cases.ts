export interface UseCase {
  slug: string;
  name: string;
  description: string;
  overview: string;
  benefits: string[];
  stats: Array<{ value: string; label: string }>;
  relatedIndustries: string[];
  faqs: Array<{ question: string; answer: string }>;
}

export const allUseCases: UseCase[] = [
  {
    slug: 'pitch-deck-sharing',
    name: 'Pitch Deck Sharing',
    description: 'Share pitch decks with investors securely. Track who opened your deck, which slides they focused on, and prevent unauthorized forwarding with dynamic watermarks and email gating.',
    overview: 'Every fundraising round involves sharing your pitch deck with dozens of investors. Without tracking, you have no idea who opened it, who forwarded it, or which slides resonated. CloakShare gives you per-investor analytics, dynamic watermarks, and automatic link expiry so your strategy stays confidential and your follow-ups are data-driven.',
    benefits: [
      'Know exactly which investors opened your deck and how long they spent on each slide',
      'Prevent forwarding with email-gated links that require verification',
      'Dynamic watermarks overlay the viewer\'s email on every slide, deterring screenshots',
      'Set links to expire after your round closes so decks stop circulating',
      'Share product demo videos alongside your deck in one tracked link',
      'Replace DocSend at a fraction of the cost with no per-seat pricing',
    ],
    stats: [
      { value: '45%', label: 'Higher response rate when founders follow up with slide-level engagement data' },
      { value: '73%', label: 'Of pitch decks get forwarded at least once without the founder\'s knowledge' },
      { value: '$0', label: 'Cost to start tracking pitch deck engagement with CloakShare free tier' },
    ],
    relatedIndustries: ['startups', 'consulting'],
    faqs: [
      { question: 'How is CloakShare different from DocSend for pitch decks?', answer: 'CloakShare is open source, API-first, supports video sharing alongside documents, and has no per-seat pricing. DocSend charges $65/user/month, lacks video support, and is a closed platform. CloakShare also offers self-hosting for complete data control.' },
      { question: 'Can investors view my pitch deck on mobile?', answer: 'Yes. The CloakShare viewer is fully responsive and works on any device with a modern browser. Documents are rendered as canvas images that load quickly on mobile connections.' },
      { question: 'Can I include a product demo video with my pitch deck?', answer: 'Yes. CloakShare is the only platform that handles both documents and video in one link. Upload your demo video and it is transcoded to adaptive HLS streaming with watermarks and watch-time analytics.' },
      { question: 'What analytics do I get for my pitch deck?', answer: 'Per-viewer data including: which slides were viewed, time spent per slide, total viewing time, number of visits, device and location info, and video watch completion. Real-time webhooks notify you the moment an investor opens your deck.' },
    ],
  },
  {
    slug: 'proposal-tracking',
    name: 'Proposal Tracking',
    description: 'Track business proposals in real time. Know the moment a prospect opens your proposal, which sections they focused on, and when to follow up for maximum close rates.',
    overview: 'Sending a proposal into the void and hoping for a response is not a strategy. CloakShare turns every proposal into a trackable, secure document with real-time notifications. Know when your prospect opens it, which pricing options they studied, and follow up at the exact right moment. Teams using tracked proposals see significantly higher close rates because they follow up with context, not guesswork.',
    benefits: [
      'Real-time notifications when a prospect opens your proposal',
      'Page-level analytics show which sections received the most attention',
      'Follow up with specific insights ("I noticed you spent time on the enterprise plan")',
      'Prevent proposals from being forwarded to competitors',
      'Automatic link expiry keeps pricing current and creates urgency',
      'API integration with your CRM for automated proposal workflows',
    ],
    stats: [
      { value: '45%', label: 'Close rate for proposals with tracked engagement vs 24% for untracked proposals' },
      { value: '3.2x', label: 'Faster response time when following up within 1 hour of proposal view' },
      { value: '68%', label: 'Of proposals are viewed within 24 hours of being sent' },
    ],
    relatedIndustries: ['consulting', 'real-estate', 'insurance'],
    faqs: [
      { question: 'How quickly will I know when a prospect opens my proposal?', answer: 'Instantly. CloakShare sends real-time webhooks when a document is opened. Connect these to Slack, email, or your CRM to get notified the moment a prospect starts reading.' },
      { question: 'Can I see which pricing tier a prospect focused on?', answer: 'Yes. Page-level analytics show time spent per page. If your pricing options are on different pages, you will see exactly which tier received the most attention.' },
      { question: 'How do I prevent a prospect from forwarding my proposal to a competitor?', answer: 'Email-gated links require the intended recipient to verify their email before viewing. Dynamic watermarks overlay the viewer\'s email on every page, making any screenshot traceable.' },
      { question: 'Can I integrate proposal tracking with my CRM?', answer: 'Yes. The CloakShare API lets you create tracked links programmatically, and webhooks send view events directly to your CRM. Build automated workflows where proposal engagement triggers follow-up sequences.' },
    ],
  },
  {
    slug: 'nda-sharing',
    name: 'NDA Sharing',
    description: 'Share NDAs and confidential agreements securely with email verification, automatic expiry, and complete audit trails. Know exactly who accessed the document and when.',
    overview: 'NDAs and confidential agreements demand more security than a PDF attachment. CloakShare provides email-verified access, password protection, automatic expiry, and complete audit trails. Every view is logged, every page tracked, and dynamic watermarks ensure any leak is traceable. For legal teams managing dozens of active NDAs, the API automates link creation and integrates with existing contract workflows.',
    benefits: [
      'Email-gated access ensures only the intended signatory can view the NDA',
      'Complete audit trail with timestamps, IP addresses, and pages viewed',
      'Automatic link expiry after the signing window closes',
      'Dynamic watermarks deter unauthorized screenshots or redistribution',
      'Password protection adds a second authentication layer',
      'API integration automates NDA distribution from your contract management system',
    ],
    stats: [
      { value: '100%', label: 'Audit trail coverage for every view of every document' },
      { value: '24hr', label: 'Typical link expiry window for time-sensitive NDAs' },
      { value: '0', label: 'Copies of the original file transmitted to the viewer (canvas rendering)' },
    ],
    relatedIndustries: ['law-firms', 'startups', 'consulting'],
    faqs: [
      { question: 'Is CloakShare secure enough for confidential legal documents?', answer: 'Yes. Documents are rendered server-side and displayed via canvas, so the original file is never transmitted to the viewer. Email gating, password protection, dynamic watermarks, and link expiry provide multiple layers of security.' },
      { question: 'Can I prove that a party received and reviewed the NDA?', answer: 'Yes. The audit trail logs the exact timestamp, viewer email (verified), IP address, pages viewed, and time per page. Export this data via API for your legal records.' },
      { question: 'Can I automate NDA distribution?', answer: 'Yes. Use the CloakShare API to programmatically create email-gated, watermarked links for each party. Integrate with your contract management or CRM system. Webhooks notify you when each party views the document.' },
      { question: 'What happens after the NDA signing deadline passes?', answer: 'Set a link expiry date when creating the link. After that date, the document becomes inaccessible. No manual cleanup required. You can also manually disable a link at any time.' },
    ],
  },
  {
    slug: 'data-room',
    name: 'Virtual Data Room',
    description: 'Run a secure virtual data room for M&A, due diligence, or fundraising. Per-document access controls, complete audit trails, and no per-seat fees. Self-hostable for data sovereignty.',
    overview: 'Traditional virtual data rooms charge thousands per month with per-seat fees that punish you for adding stakeholders. CloakShare provides the same security features at a fraction of the cost: email-gated access per document, page-level audit trails, dynamic watermarks, and automatic link expiry. Self-host for complete data sovereignty during sensitive M&A transactions.',
    benefits: [
      'Per-document access controls with email gating and password protection',
      'Complete audit trails showing who viewed what, when, and for how long',
      'No per-seat pricing allows you to add unlimited stakeholders',
      'Self-hostable via Docker for full data sovereignty during M&A',
      'Dynamic watermarks trace any document leak to the source',
      'API-driven setup lets you provision the data room programmatically',
    ],
    stats: [
      { value: '$0', label: 'Per-seat fees, regardless of how many stakeholders need access' },
      { value: '100%', label: 'Data sovereignty when self-hosted on your infrastructure' },
      { value: '6.5x', label: 'Cheaper than traditional VDR solutions for a 10-person due diligence team' },
    ],
    relatedIndustries: ['startups', 'law-firms', 'real-estate', 'accounting'],
    faqs: [
      { question: 'How does CloakShare compare to traditional virtual data rooms?', answer: 'Traditional VDRs like Intralinks or Datasite charge $5,000+ per month with per-seat fees. CloakShare provides email-gated access, audit trails, watermarks, and expiry at $99/month with no per-seat pricing. Self-hosting is available for data sovereignty.' },
      { question: 'Can I control access per document in the data room?', answer: 'Yes. Each document gets its own link with independent access controls. Restrict Document A to the buyer\'s legal team and Document B to their finance team. Each link has its own email gate, password, expiry, and audit trail.' },
      { question: 'Is a self-hosted CloakShare data room secure enough for M&A?', answer: 'Yes. Self-hosting means all document data stays on your infrastructure. Canvas-based rendering prevents file downloads. Dynamic watermarks, email gating, password protection, and link expiry provide layered security.' },
      { question: 'Can I see which due diligence documents received the most attention?', answer: 'Yes. Page-level analytics show time spent per page across all documents. Identify which sections buyers are scrutinizing and prepare accordingly.' },
    ],
  },
  {
    slug: 'board-deck-distribution',
    name: 'Board Deck Distribution',
    description: 'Distribute board meeting materials securely to directors and advisors. Track who reviewed the deck before the meeting, watermark every page, and automatically expire access afterward.',
    overview: 'Board materials contain the most sensitive information in any organization: financials, strategy, compensation, and legal matters. Email attachments create permanent, uncontrolled copies. CloakShare gives you per-director tracking so you know who reviewed the materials before the meeting, dynamic watermarks that deter leaks, and automatic expiry that revokes access after the board meeting.',
    benefits: [
      'Know which directors reviewed materials before the meeting',
      'Dynamic watermarks on every page deter leaks of sensitive board data',
      'Automatic link expiry revokes access after the board meeting date',
      'Email gating ensures only board members can access the deck',
      'Page-level analytics show which sections received the most attention',
      'Replace per-seat tools and save on board management software costs',
    ],
    stats: [
      { value: '62%', label: 'Of board members review materials within 48 hours when tracked links are used' },
      { value: '$0', label: 'Per-director cost with CloakShare vs $65/user with DocSend' },
      { value: '100%', label: 'Visibility into which directors prepared for the meeting' },
    ],
    relatedIndustries: ['startups', 'nonprofits', 'franchise'],
    faqs: [
      { question: 'How do I know which board members read the deck before the meeting?', answer: 'Each board member receives a unique, email-gated link. Analytics show exactly who opened it, which pages they viewed, and how long they spent reviewing. You can see preparation status at a glance.' },
      { question: 'Can I share the board deck and a presentation video together?', answer: 'Yes. CloakShare handles both documents and video. Share the board deck alongside a CEO video update, all tracked within the same platform.' },
      { question: 'What happens to the board materials after the meeting?', answer: 'Set link expiry dates for the day after the board meeting. Access is automatically revoked. No manual cleanup, no stale documents floating around in inboxes.' },
      { question: 'How do I prevent board materials from being leaked?', answer: 'Dynamic watermarks overlay each director\'s email on every page. Canvas-based rendering prevents downloads. If a screenshot leaks, the watermark traces it to the source.' },
    ],
  },
  {
    slug: 'video-proposals',
    name: 'Video Proposals',
    description: 'Send tracked video proposals to prospects. Know who watched, how far they got, and follow up with data. The only platform combining document and video sharing with per-viewer analytics.',
    overview: 'Video proposals convert better than text, but traditional video hosting gives you zero insight into viewer engagement. CloakShare lets you send watermarked, tracked video proposals with per-viewer analytics. Know exactly who watched, how far they got, and which sections they rewatched. Combine video with a written proposal in one tracked link. No competitor offers both document and video sharing with per-viewer analytics.',
    benefits: [
      'Per-viewer watch-time analytics show exactly how much each prospect watched',
      'Dynamic watermarks on every video frame prevent unauthorized redistribution',
      'Combine a PDF proposal with a video walkthrough in one tracked experience',
      'Email gating ensures only the intended recipient views your proposal',
      'Adaptive HLS streaming delivers smooth playback on any device and connection',
      'No YouTube, no Vimeo, no Loom privacy gaps or branding issues',
    ],
    stats: [
      { value: '56%', label: 'Higher engagement rate for video proposals vs text-only proposals' },
      { value: '0', label: 'Other platforms that combine document + video sharing with per-viewer analytics' },
      { value: '1080p', label: 'Maximum quality with adaptive bitrate streaming for all connections' },
    ],
    relatedIndustries: ['consulting', 'real-estate', 'recruiting'],
    faqs: [
      { question: 'What video formats does CloakShare support?', answer: 'Upload MP4, MOV, or WebM files. CloakShare automatically transcodes them to adaptive HLS streaming with 720p and 1080p quality tiers. No manual encoding required.' },
      { question: 'Can I send a document and video in the same link?', answer: 'Yes. CloakShare is the only platform that handles both documents and video with unified per-viewer analytics. Attach a PDF proposal alongside a video walkthrough.' },
      { question: 'How are video proposals watermarked?', answer: 'A canvas overlay draws the viewer\'s email as a watermark on every frame of the video in real time. If someone screen-records your proposal, the recording contains their email address.' },
      { question: 'Will video proposals work on mobile?', answer: 'Yes. HLS adaptive streaming adjusts quality based on the viewer\'s connection speed. The viewer works on any modern browser, desktop or mobile, without plugins.' },
    ],
  },
  {
    slug: 'training-content',
    name: 'Training Content Distribution',
    description: 'Distribute training materials and certification content securely. Track completion rates per trainee, prevent unauthorized sharing, and watermark every page and video frame.',
    overview: 'Distributing training content through shared drives or email attachments means losing control the moment you hit send. CloakShare gives you per-trainee tracking with completion rates, dynamic watermarks that trace any leak, and API-driven distribution that scales from 10 trainees to 10,000. Support both documents and video training content in one platform.',
    benefits: [
      'Completion tracking shows exactly which trainees finished and who dropped off',
      'Dynamic watermarks on documents and video frames prevent unauthorized sharing',
      'API-driven link generation scales distribution to thousands of trainees',
      'Email gating ensures only authorized trainees access the content',
      'Link expiry automatically revokes access when training periods end',
      'HLS video streaming supports training videos alongside written materials',
    ],
    stats: [
      { value: '89%', label: 'Training completion rate when trainees know their progress is tracked' },
      { value: '3x', label: 'Faster identification of trainees who need follow-up support' },
      { value: '100%', label: 'Accountability with per-trainee page-level and video analytics' },
    ],
    relatedIndustries: ['franchise', 'healthcare', 'education'],
    faqs: [
      { question: 'Can I track training completion per person?', answer: 'Yes. Page-level analytics show each trainee\'s progress: which pages they viewed, time per page, and overall completion percentage. For video content, watch-time analytics show exactly how much each person watched.' },
      { question: 'How do I distribute training to hundreds of people?', answer: 'Use the CloakShare API to programmatically generate unique, email-gated links for each trainee. Integrate with your LMS or HR system. Webhooks notify you when each person accesses the content.' },
      { question: 'Can I include training videos alongside documents?', answer: 'Yes. CloakShare handles both documents and video. Upload training videos in MP4, MOV, or WebM format. They are transcoded to adaptive HLS streaming with per-viewer watermarks and watch-time analytics.' },
      { question: 'What happens when a training period ends?', answer: 'Set link expiry dates aligned with training periods. Access is automatically revoked when the date passes. No manual cleanup of stale links.' },
    ],
  },
  {
    slug: 'contract-sharing',
    name: 'Contract Sharing',
    description: 'Share contracts and legal agreements securely with email verification, password protection, and complete audit trails. Prevent unauthorized forwarding and prove document delivery.',
    overview: 'Contracts contain your most sensitive business terms. Sharing them as email attachments creates permanent, uncontrolled copies. CloakShare ensures only verified recipients can view contracts, provides a complete audit trail for legal compliance, and automatically revokes access after the signing period. Canvas-based rendering means the original document file is never transmitted to the viewer.',
    benefits: [
      'Email-verified access ensures only the intended party views the contract',
      'Complete audit trail with timestamps, IP addresses, and pages viewed for legal records',
      'Password protection adds a second layer of authentication',
      'Canvas-based rendering prevents downloading the original contract file',
      'Automatic link expiry after the signing deadline creates urgency and security',
      'Dynamic watermarks trace any unauthorized screenshot to the source',
    ],
    stats: [
      { value: '100%', label: 'Audit trail for every view, every page, every second' },
      { value: '0', label: 'Original file copies transmitted to the viewer (canvas rendering)' },
      { value: '4', label: 'Security layers: email gate + password + watermark + expiry' },
    ],
    relatedIndustries: ['law-firms', 'real-estate', 'consulting', 'insurance'],
    faqs: [
      { question: 'Can I prove that a party received and reviewed the contract?', answer: 'Yes. The audit trail logs the verified email address, timestamp, IP address, every page viewed, and time spent per page. Export this data via API for your legal records.' },
      { question: 'How does CloakShare prevent contract terms from leaking?', answer: 'Four layers of protection: email gating verifies the viewer\'s identity, password protection adds a second factor, dynamic watermarks trace any screenshot, and canvas rendering prevents file downloads.' },
      { question: 'Can I revoke contract access after signing?', answer: 'Yes. Set link expiry dates or manually disable links at any time. Once disabled, the contract is immediately inaccessible.' },
      { question: 'Can I integrate contract sharing with my workflow?', answer: 'Yes. The CloakShare API lets you create tracked links programmatically from your contract management system. Webhooks notify you when each party views the contract.' },
    ],
  },
  {
    slug: 'grant-proposals',
    name: 'Grant Proposals',
    description: 'Share grant proposals with funders securely. Track which sections received attention, prevent forwarding to competing organizations, and follow up with data-driven insights.',
    overview: 'Grant proposals represent months of work and contain proprietary program designs. Sharing them via email means losing all visibility into funder engagement. CloakShare gives you page-level analytics that reveal which sections a funder focused on, webhooks that notify you the moment a proposal is opened, and watermarks that prevent unauthorized redistribution to competing organizations.',
    benefits: [
      'Page-level analytics reveal which program components the funder focused on',
      'Real-time webhooks notify you when a funder opens your proposal',
      'Dynamic watermarks prevent forwarding to competing organizations',
      'Email gating ensures only the intended program officer can view the proposal',
      'Follow up with specific insights about which sections resonated',
      'Free tier covers most nonprofit grant submission needs',
    ],
    stats: [
      { value: '2.4x', label: 'More effective follow-ups when referencing specific sections the funder reviewed' },
      { value: '50', label: 'Free links per month on CloakShare free tier, enough for most grant cycles' },
      { value: '73%', label: 'Of grant proposals are forwarded internally at the foundation without the applicant knowing' },
    ],
    relatedIndustries: ['nonprofits', 'education', 'healthcare'],
    faqs: [
      { question: 'Can I use CloakShare for grant proposals on a nonprofit budget?', answer: 'Yes. The free tier includes 50 links and 500 views per month with full analytics, email gating, and watermarks. That covers most grant submission cycles without any cost.' },
      { question: 'How do I know if a program officer reviewed my entire proposal?', answer: 'Page-level analytics show completion percentage and time per page. You can see whether the funder read just the executive summary or studied the budget in detail.' },
      { question: 'Can I include a program video with my grant proposal?', answer: 'Yes. Upload an impact video or program overview and CloakShare transcodes it to HLS streaming with per-viewer analytics. Funders who watch your video are more engaged prospects.' },
      { question: 'How do I prevent competing nonprofits from seeing my proposal?', answer: 'Email-gated links ensure only the intended funder can access your proposal. Dynamic watermarks overlay the viewer\'s email on every page, making any unauthorized sharing traceable.' },
    ],
  },
  {
    slug: 'franchise-disclosure',
    name: 'Franchise Disclosure Documents',
    description: 'Distribute Franchise Disclosure Documents (FDD) with per-recipient tracking, automatic expiry, and complete audit trails. Document review compliance for regulatory requirements.',
    overview: 'Federal and state regulations require franchisors to provide the Franchise Disclosure Document at least 14 days before signing. CloakShare provides documented proof of delivery and review with per-recipient tracking, page-level analytics, and complete audit trails. Know exactly when a prospective franchisee received the FDD, which sections they reviewed, and whether they met the minimum review period.',
    benefits: [
      'Documented proof of FDD delivery and review for regulatory compliance',
      'Per-recipient tracking shows which sections each prospect reviewed',
      'Automatic link expiry after the review period creates natural follow-up triggers',
      'Dynamic watermarks prevent unauthorized redistribution of confidential FDD data',
      'API integration automates FDD distribution from your franchise management system',
      'Audit trails exportable via API for compliance records',
    ],
    stats: [
      { value: '14', label: 'Day minimum FDD review period required by FTC rules' },
      { value: '100%', label: 'Documented proof of delivery and review for every recipient' },
      { value: '$0', label: 'Per-recipient fees, scale from 10 to 500 prospects without cost increase' },
    ],
    relatedIndustries: ['franchise'],
    faqs: [
      { question: 'Does CloakShare help with FDD compliance requirements?', answer: 'Yes. The audit trail documents exactly when each prospect received the FDD, when they first opened it, which pages they viewed, and their total review time. This provides evidence of the 14-day review period required by FTC franchise rules.' },
      { question: 'Can I distribute the FDD to hundreds of prospects simultaneously?', answer: 'Yes. Use the API to generate unique, tracked links for each prospect. Each link has independent analytics and access controls. Scale from 10 to 500 prospects without per-recipient fees.' },
      { question: 'How do I know if a prospect is ready to move forward?', answer: 'Analytics show completion percentage and time per section. A prospect who spent 45 minutes reviewing the financial performance section is more engaged than one who skimmed the table of contents.' },
      { question: 'What happens to FDD access when a prospect decides not to proceed?', answer: 'Disable the link instantly or set automatic expiry dates. Once the link is disabled, the FDD is no longer accessible. The audit trail is preserved for your records.' },
    ],
  },
];

export function getUseCaseBySlug(slug: string): UseCase | undefined {
  return allUseCases.find((uc) => uc.slug === slug);
}

export function getUseCaseSlugs(): string[] {
  return allUseCases.map((uc) => uc.slug);
}
