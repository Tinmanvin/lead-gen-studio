export const dashboardStats = [
  { label: 'Total Leads', value: '2,847', trend: '+12%' },
  { label: 'Emails Sent', value: '1,203', trend: '+8%' },
  { label: 'Reply Rate', value: '14.2%', trend: '+3.1%' },
  { label: 'Demos Built', value: '89', trend: '+15%' },
  { label: 'Pipeline Value', value: '$342K', trend: '+22%' },
];

export const briefingItems = [
  { color: '#ef4444', text: '23 hot leads need review — 8 scored above 90', link: 'Lead Gen', screen: 'leadgen', dotOpacity: 0.7 },
  { color: '#f59e0b', text: 'LinkedIn daily send budget at 12/15 — 3 remaining', link: 'LinkedIn', screen: 'linkedin', dotOpacity: 0.7 },
  { color: '#7b39fc', text: 'Indeed Hijacker fired 34 emails overnight — 4 opens', link: 'Indeed', screen: 'indeed', dotOpacity: 0.7 },
  { color: 'rgba(255,255,255,0.2)', text: 'Upwork scanner completed — 47 gigs matched', link: 'Upwork', screen: 'upwork', dotOpacity: 1 },
  { color: '#7b39fc', text: 'Email sequence "Redesign Pitch v3" performing +18% vs control', link: 'Outreach', screen: 'outreach', dotOpacity: 0.7 },
];

export const performanceBlocks = [
  {
    title: 'OUTREACH',
    metrics: [
      { label: 'Sent Today', value: '142' },
      { label: 'Open Rate', value: '34%' },
      { label: 'Reply Rate', value: '14.2%' },
      { label: 'Bounced', value: '2.1%' },
    ],
  },
  {
    title: 'LINKEDIN',
    metrics: [
      { label: 'Posts This Week', value: '4' },
      { label: 'Impressions', value: '12.4K' },
      { label: 'Profile Views', value: '89' },
      { label: 'Connection Reqs', value: '12' },
    ],
  },
  {
    title: 'DEMOS',
    metrics: [
      { label: 'Built Today', value: '7' },
      { label: 'Opened', value: '23' },
      { label: 'Avg Time on Demo', value: '2m 14s' },
      { label: 'CTA Clicks', value: '11' },
    ],
  },
  {
    title: 'INDEED',
    metrics: [
      { label: 'Auto-Fired', value: '34' },
      { label: 'Cap Remaining', value: '16' },
      { label: 'Opens', value: '4' },
      { label: 'Replies', value: '1' },
    ],
  },
];

export const chartData = [
  { day: 'Mon', replyRate: 11.2, demoClicks: 8, emailsSent: 180 },
  { day: 'Tue', replyRate: 12.8, demoClicks: 12, emailsSent: 195 },
  { day: 'Wed', replyRate: 10.5, demoClicks: 7, emailsSent: 160 },
  { day: 'Thu', replyRate: 14.1, demoClicks: 15, emailsSent: 210 },
  { day: 'Fri', replyRate: 15.3, demoClicks: 18, emailsSent: 225 },
  { day: 'Sat', replyRate: 13.7, demoClicks: 11, emailsSent: 140 },
  { day: 'Sun', replyRate: 14.2, demoClicks: 14, emailsSent: 120 },
];

export const topLeads = [
  { initials: 'BM', company: 'Brighton Medical Centre', niche: 'Healthcare', nicheColor: '#22c55e', services: ['Widget Demo', 'Redesign'], score: 97, status: 'Replied' },
  { initials: 'TC', company: 'Thames Consulting Group', niche: 'Finance', nicheColor: '#3b82f6', services: ['New Site', 'Email'], score: 94, status: 'Demo Opened' },
  { initials: 'SP', company: 'Sydney Plumbing Pros', niche: 'Trades', nicheColor: '#f59e0b', services: ['Widget Demo'], score: 91, status: 'Booked' },
  { initials: 'ML', company: 'Melbourne Legal Partners', niche: 'Legal', nicheColor: '#8b5cf6', services: ['Redesign', 'New Site'], score: 88, status: 'Replied' },
  { initials: 'KC', company: 'Kent Care Services', niche: 'Aged Care', nicheColor: '#ec4899', services: ['Email', 'Widget Demo'], score: 85, status: 'Demo Opened' },
];

export const massEmailLeads = [
  { company: 'Oakwood Dental', dm: 'Dr. Sarah Chen', niche: 'Dental', nicheColor: '#22c55e', services: ['Widget Demo', 'Redesign'], score: 92, hasDemoReady: true, tier: 'hot' as const },
  { company: 'Pacific Coast Physio', dm: 'James McAllister', niche: 'Healthcare', nicheColor: '#22c55e', services: ['New Site'], score: 87, hasDemoReady: false, tier: 'hot' as const },
  { company: 'Manchester Motors', dm: 'David Wright', niche: 'Automotive', nicheColor: '#f59e0b', services: ['Email', 'Widget Demo'], score: 84, hasDemoReady: true, tier: 'standard' as const },
  { company: 'Brisbane Beauty Bar', dm: 'Lisa Nguyen', niche: 'Beauty', nicheColor: '#ec4899', services: ['Redesign'], score: 81, hasDemoReady: false, tier: 'standard' as const },
  { company: 'Cornwall Kitchens', dm: 'Mark Thompson', niche: 'Trades', nicheColor: '#f59e0b', services: ['New Site', 'Email'], score: 78, hasDemoReady: true, tier: 'standard' as const },
  { company: 'Adelaide Accounting', dm: 'Rachel Cooper', niche: 'Finance', nicheColor: '#3b82f6', services: ['Widget Demo'], score: 76, hasDemoReady: false, tier: 'standard' as const },
  { company: 'Leeds Law Group', dm: 'Andrew Patterson', niche: 'Legal', nicheColor: '#8b5cf6', services: ['Redesign', 'Email'], score: 73, hasDemoReady: true, tier: 'cold' as const },
  { company: 'Perth Pet Care', dm: 'Emma Sullivan', niche: 'Veterinary', nicheColor: '#22c55e', services: ['New Site'], score: 71, hasDemoReady: false, tier: 'cold' as const },
  { company: 'Oxford Opticians', dm: 'Dr. Michael Lee', niche: 'Healthcare', nicheColor: '#22c55e', services: ['Widget Demo', 'Redesign'], score: 68, hasDemoReady: true, tier: 'cold' as const },
  { company: 'Gold Coast Gym', dm: 'Tom Bradley', niche: 'Fitness', nicheColor: '#f59e0b', services: ['Email'], score: 65, hasDemoReady: false, tier: 'cold' as const },
];

export const hotLeads = [
  { company: 'Brighton Medical Centre', dm: 'Dr. Helen Ward', niche: 'Healthcare', nicheColor: '#22c55e', services: ['Widget Demo', 'Redesign'], score: 97, channels: { linkedin: true, whatsapp: true, facebook: false, email: true } },
  { company: 'Thames Consulting Group', dm: 'Robert James', niche: 'Finance', nicheColor: '#3b82f6', services: ['New Site', 'Email'], score: 94, channels: { linkedin: true, whatsapp: false, facebook: true, email: true } },
  { company: 'Sydney Plumbing Pros', dm: 'Craig Wilson', niche: 'Trades', nicheColor: '#f59e0b', services: ['Widget Demo'], score: 91, channels: { linkedin: true, whatsapp: true, facebook: true, email: true } },
];

export const linkedinPosts = [
  { day: 'Mon', title: 'AI in Healthcare', content: 'The healthcare industry is at a tipping point. We\'ve seen 3x growth in AI adoption among medical practices in AU and UK markets...', status: 'scheduled' },
  { day: 'Tue', title: '5 Signs Your Website Needs Help', content: 'If your bounce rate is above 60%, your contact form is buried 3 clicks deep, or your mobile experience looks like 2015...', status: 'draft' },
  { day: 'Wed', title: 'Case Study: Dental Practice', content: 'Last month we helped a dental practice in Melbourne increase their online bookings by 340% with one simple widget...', status: 'published' },
  { day: 'Thu', title: 'The Cold Email is Dead?', content: 'Everyone says cold email is dead. Our data says otherwise. 14.2% reply rate across 1,200+ sends this week alone...', status: 'scheduled' },
  { day: 'Fri', title: 'Weekend Reading List', content: 'Three articles that changed how I think about B2B outreach this quarter...', status: 'draft' },
];

export const linkedinOutreach = [
  { name: 'Dr. Helen Ward', company: 'Brighton Medical', title: 'Practice Manager', queue: 'Connection Req', note: 'Hi Helen, I noticed Brighton Medical\'s website could benefit from an AI booking widget. We\'ve helped similar practices increase bookings by 340%. Would love to connect and share some ideas.', message: '' },
  { name: 'Robert James', company: 'Thames Consulting', title: 'Managing Director', queue: 'Group DM', note: '', message: 'Robert, I came across Thames Consulting in a finance industry group. Your firm\'s growth is impressive — I think we could help accelerate your lead pipeline with some targeted AI outreach tools. Happy to share a quick demo.' },
  { name: 'Craig Wilson', company: 'Sydney Plumbing', title: 'Owner', queue: 'Connection Req', note: 'G\'day Craig, saw your team\'s work across Sydney — impressive growth. We help trades businesses like yours capture more leads through smart website widgets. Keen to connect?', message: '' },
  { name: 'Lisa Nguyen', company: 'Brisbane Beauty', title: 'Founder', queue: 'Connection Req', note: 'Hi Lisa, Brisbane Beauty Bar caught my eye — love the brand. We specialise in helping beauty businesses convert more website visitors into bookings. Would love to connect.', message: '' },
];

export const indeedJobs = [
  { company: 'Sunrise Aged Care', jobTitle: 'Intake Coordinator', emailFound: true, template: 'Intake Coordinator', status: 'Sent' as const, time: '2h ago', email: 'Hi there, I noticed Sunrise Aged Care is hiring an Intake Coordinator. We help aged care facilities streamline their intake process with AI-powered widgets...' },
  { company: 'Coastal Medical', jobTitle: 'Receptionist', emailFound: true, template: 'Medical Reception', status: 'Opened' as const, time: '3h ago', email: 'Hi, I saw Coastal Medical is looking for reception staff. Our AI booking system could reduce your admin workload by 60%...' },
  { company: 'Peak Fitness Studio', jobTitle: 'Membership Coordinator', emailFound: true, template: 'Fitness Outreach', status: 'Queued' as const, time: '4h ago', email: 'Hello, Peak Fitness is hiring for membership coordination — we help gyms automate member sign-ups and reduce manual admin...' },
  { company: 'Heritage Dental', jobTitle: 'Practice Manager', emailFound: false, template: 'Dental Practice', status: 'Queued' as const, time: '4h ago', email: '' },
  { company: 'Bayside Vets', jobTitle: 'Client Services', emailFound: true, template: 'Vet Practice', status: 'Replied' as const, time: '1h ago', email: 'Hi there, noticed Bayside Vets is growing the team. We specialise in helping vet clinics capture more bookings online...' },
  { company: 'Metro Plumbing Co', jobTitle: 'Office Admin', emailFound: true, template: 'Trades Admin', status: 'Sent' as const, time: '5h ago', email: 'Hello, saw Metro Plumbing is hiring admin staff. Our AI lead capture widgets help trades businesses automate enquiries...' },
];

export const upworkGigs = [
  { title: 'AI Chatbot for E-commerce Store', budget: '$2,500', posted: '2 hours ago', proposals: 8, score: 95, type: 'SOLO' as const, skills: ['React', 'OpenAI', 'Node.js'], description: 'Need an AI-powered chatbot that can handle customer queries, recommend products, and process basic order status checks for our Shopify store.', approach: 'Build a React widget with OpenAI integration, embed directly in Shopify theme. Use vector search for product recommendations.', timeEstimate: '5-7 days' },
  { title: 'Website Redesign for Law Firm', budget: '$4,200', posted: '4 hours ago', proposals: 12, score: 91, type: 'SOLO' as const, skills: ['React', 'Tailwind', 'Figma'], description: 'Complete redesign of our law firm website. Need modern, professional look with client portal and appointment booking system.', approach: 'Full Tailwind + React build with Cal.com integration for bookings. Clean, trust-building design language.', timeEstimate: '10-14 days' },
  { title: 'Lead Gen Dashboard with Analytics', budget: '$3,800', posted: '6 hours ago', proposals: 5, score: 88, type: 'COLLAB' as const, skills: ['React', 'Supabase', 'Charts'], description: 'Build a lead generation dashboard that tracks outreach campaigns, shows conversion funnels, and provides real-time analytics.', approach: 'React + Supabase backend, Recharts for visualisation, real-time subscriptions for live data.', timeEstimate: '8-12 days' },
  { title: 'Mobile App Landing Page', budget: '$1,200', posted: '8 hours ago', proposals: 18, score: 82, type: 'SOLO' as const, skills: ['HTML', 'CSS', 'Animation'], description: 'High-converting landing page for a fitness app launch. Need animations, app store badges, and email capture.', approach: 'Single-page React build with Framer Motion animations, responsive mobile-first design.', timeEstimate: '3-4 days' },
  { title: 'CRM Integration & API Development', budget: '$5,500', posted: '1 hour ago', proposals: 3, score: 94, type: 'COLLAB' as const, skills: ['Node.js', 'REST API', 'Salesforce'], description: 'Integrate our existing CRM with Salesforce and build custom API endpoints for data synchronisation between platforms.', approach: 'Node.js middleware with Salesforce REST API, webhook-based sync, error handling and retry logic.', timeEstimate: '12-16 days' },
  { title: 'Portfolio Website with CMS', budget: '$1,800', posted: '12 hours ago', proposals: 22, score: 72, type: 'SOLO' as const, skills: ['Next.js', 'Sanity', 'Tailwind'], description: 'Personal portfolio site for a photographer with CMS for easy content updates and gallery management.', approach: 'React with headless CMS, lazy-loaded image galleries, minimal elegant design.', timeEstimate: '5-6 days' },
  { title: 'SaaS Billing System', budget: '$6,200', posted: '3 hours ago', proposals: 7, score: 90, type: 'COLLAB' as const, skills: ['Stripe', 'React', 'Node.js'], description: 'Complete billing system with Stripe integration, subscription management, invoicing, and usage-based pricing support.', approach: 'Stripe Billing API integration, React dashboard, webhook handlers for subscription lifecycle.', timeEstimate: '14-18 days' },
  { title: 'Email Template Builder', budget: '$2,800', posted: '5 hours ago', proposals: 9, score: 85, type: 'SOLO' as const, skills: ['React', 'DnD', 'MJML'], description: 'Drag-and-drop email template builder with preview, MJML output, and template library functionality.', approach: 'React DnD Kit for builder, MJML for email-safe output, template save/load with local storage.', timeEstimate: '8-10 days' },
  { title: 'Real-time Chat Application', budget: '$3,200', posted: '7 hours ago', proposals: 14, score: 78, type: 'COLLAB' as const, skills: ['WebSocket', 'React', 'Redis'], description: 'Build a real-time chat application with channels, direct messaging, file sharing, and message search.', approach: 'WebSocket server with Redis pub/sub, React frontend with optimistic updates and infinite scroll.', timeEstimate: '10-14 days' },
];

export const settingsTemplates = [
  { id: 1, category: 'Indeed Hijacker', name: 'Intake Coordinator', content: 'Hi {{name}},\n\nI noticed {{company}} is hiring for an {{job_title}} position. This often signals growth — and with growth comes the need for better systems.\n\nWe help businesses like yours automate intake and lead capture with AI-powered widgets that work 24/7.\n\nWould you be open to a quick demo?\n\nBest,\nFabio' },
  { id: 2, category: 'Indeed Hijacker', name: 'Medical Reception', content: 'Hi {{name}},\n\nSaw that {{company}} is looking for reception staff. Our AI booking widget could handle 60% of those incoming calls and online bookings automatically.\n\nHappy to show you how it works — takes 5 minutes.\n\nCheers,\nFabio' },
  { id: 3, category: 'Email Sequences', name: 'Redesign Pitch v3', content: 'Subject: Quick question about {{company}}\'s website\n\nHi {{name}},\n\nI took a look at {{company}}\'s site and noticed a few areas where a modern redesign could significantly improve your conversion rate.\n\nWe recently helped a similar {{niche}} business increase their online enquiries by 280%.\n\nWould it be worth a 10-minute chat?\n\nFabio' },
];

export const geographySettings = [
  { flag: '🇦🇺', country: 'Australia', scrape: true, outreach: true },
  { flag: '🇬🇧', country: 'United Kingdom', scrape: true, outreach: true },
  { flag: '🇺🇸', country: 'United States', scrape: true, outreach: false },
];
