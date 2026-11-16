// Demo data: mailboxes for people and for (made-up) companies, and an inbox that looks lived in.
const crypto = require('crypto');

const id = (p) => p + '_' + crypto.randomBytes(6).toString('hex');
const hash = (secret) => {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(String(secret), salt, 32).toString('hex');
};

const DOMAIN = 'gmai.app';
const COLORS = ['#00897B', '#5C6BC0', '#E8710A', '#D81B60', '#7CB342', '#8E24AA', '#039BE5', '#F4511E', '#6D4C41', '#3949AB', '#C0CA33', '#F6BF26'];
const colorFor = (s) => COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

function buildSeed() {
  const now = Date.now();
  const H = 3600000;
  const D = 24 * H;
  const db = {
    mailboxes: [], messages: [], items: [], labels: [], files: [],
    sessions: {}, adminSessions: {}, admins: [], auditLogs: [],
    settings: {
      appName: 'Gmai',
      domain: DOMAIN,
      maintenanceMode: false,
      maintenanceMessage: 'Gmai is being updated. Please try again in a few minutes.',
      announcement: '',
      allowSignup: true,
      maxAttachmentMB: 2,
      appVersion: 'v1.0.0',
      searchHint: 'Ask Gmai',
      features: { meet: true, summarize: true, attachments: true, smartReply: true, snooze: true, signup: true },
    },
  };

  db.admins.push({ id: id('adm'), username: 'admin', name: 'Super Admin', passHash: hash('admin123'), role: 'super', createdAt: now });

  // People who sign in to the app (password demo123) and company senders (no login).
  const box = (name, email, opts = {}) => {
    const m = {
      id: id('box'), name, email: email.toLowerCase(), passHash: opts.password ? hash(opts.password) : '', kind: opts.kind || 'user',
      color: opts.color || colorFor(email), photo: opts.photo || null, signature: opts.signature || '', category: opts.category || 'primary',
      blocked: false, createdAt: now - (opts.age || 200) * D, lastActive: 0,
    };
    db.mailboxes.push(m);
    return m;
  };
  const me = box('akshay reddy', `akshay@${DOMAIN}`, { password: 'demo123', color: '#00897B', signature: 'Kalluri Akshay Reddy' });
  const priya = box('Priya Sharma', `priya@${DOMAIN}`, { password: 'demo123' });
  const rahul = box('Rahul Verma', `rahul@${DOMAIN}`, { password: 'demo123' });
  const social = box('Social media Manager', `socialmedia@${DOMAIN}`, { password: 'demo123', color: '#1E5AA8' });
  const jayashree = box('Jayashree P', `jayashree@${DOMAIN}`, { password: 'demo123', color: '#F4511E' });
  const madhavi = box('Madhavi K', `madhavi@${DOMAIN}`, { password: 'demo123', color: '#00897B' });

  const S = (name, email, category, color) => box(name, email, { kind: 'sender', category, color });
  const quant = S('QuantFund', 'team@quantfund.io', 'primary', '#29B6F6');
  const tradewise = S('Tradewise Outlook', 'outlook@tradewise.io', 'primary', '#9E9E9E');
  const careerhub = S('CareerHub AI Support', 'support@careerhub.io', 'primary', '#EC407A');
  const codehost = S('CodeHost', 'noreply@codehost.dev', 'primary', '#E57373');
  const skyline = S('Customer Support - Skyline Travel', 'support@skylinetravel.in', 'primary', '#F6BF26');
  const verify = S('no-reply', 'no-reply@careers.novacorp.com', 'primary', '#7986CB');
  const campus = S('Campus Jobs', 'alerts@campusjobs.in', 'primary', '#1A73E8');
  const shopkart = S('ShopKart Deals', 'deals@shopkart.in', 'promotions', '#FB8C00');
  const fivers = S('Market Masters', 'hello@marketmasters.io', 'promotions', '#43A047');
  const digibank = S('Digibank Alerts', 'alerts@digibank.in', 'updates', '#E53935');
  const linkup = S('Linkup', 'notifications@linkup.net', 'social', '#1565C0');
  const cloudhost = S('CloudDeploy', 'no-reply@clouddeploy.dev', 'updates', '#212121');
  const lottery = S('Prize Desk', 'winner@prize-desk.biz', 'primary', '#9E9E9E');

  const addr = (m) => ({ name: m.name, email: m.email });
  let order = 0;
  // Creates a message and the mailbox copies (inbox for recipients, sent for the sender).
  const mail = (from, to, subject, body, ago, opts = {}) => {
    const date = now - ago - (order++ * 1000);
    const m = {
      id: id('msg'), threadId: opts.thread || id('thr'), from: addr(from), to: to.map(addr), cc: (opts.cc || []).map(addr), bcc: [],
      subject, body, date, attachments: opts.attachments || [], inReplyTo: opts.inReplyTo || null,
    };
    db.messages.push(m);
    if (from.kind === 'user') db.items.push({ id: id('itm'), box: from.email, mid: m.id, tid: m.threadId, folder: 'sent', category: 'primary', read: true, starred: false, important: false, labels: [] });
    [...to, ...(opts.cc || [])].forEach((r) => {
      if (r.kind !== 'user') return;
      db.items.push({
        id: id('itm'), box: r.email, mid: m.id, tid: m.threadId, folder: opts.folder || 'inbox', category: opts.category || from.category || 'primary',
        read: opts.read ?? ago > 2 * D, starred: !!opts.starred, important: !!opts.important, labels: [],
      });
    });
    return m;
  };
  const pdf = (name, size) => ({ id: id('fil'), name, type: 'application/pdf', size, demo: true });
  const png = (name, size) => ({ id: id('fil'), name, type: 'image/png', size, demo: true });

  // --- Inbox, newest first ---
  mail(quant, [me], 'Black Friday for QuantFund affiliates: 30% commission',
    'Hi akshay,\n\nEarn commission on qualifying purchases this Black Friday.\n\n**What you get**\n- 30% commission on every challenge sold\n- Weekly payouts\n- A personal dashboard to track clicks\n\nStart sharing your link today: https://quantfund.io/affiliates\n\nTeam QuantFund', 2 * H, { read: false });
  mail(fivers, [me], 'Market Masters is back: 2 hours left', 'Our biggest sale of the year ends tonight.\n\n# 40% off every plan\n\nUse code MASTER40 at checkout.\n\nhttps://marketmasters.io/sale', 3 * H, { read: false });
  mail(tradewise, [me], '🚀 Macro Outlook: November', 'The minutes drop Wednesday. Here is what we are watching this week:\n\n- Rate decision expectations\n- Bond yields at a 3 month high\n- Earnings from the big tech names\n\nRead the full outlook: https://tradewise.io/outlook\n\nTradewise Research', 4 * H, { read: false, important: true });
  mail(digibank, [me], 'digibank: Your account statement is ready', 'Dear Customer,\n\nYour e-statement for October is now available in the digibank app.\n\nThis is a system generated mail. Please do not reply.', 5 * H, { read: false });
  mail(linkup, [me], 'You have 1 new invitation', 'Hi akshay,\n\nRahul Verma wants to connect with you on Linkup.\n\nAccept: https://linkup.net/invitations', 6 * H, { read: false });
  mail(careerhub, [me], 'One week left to submit for the AI Fellowship', 'Submissions close in a week. Make sure your profile and resume are up to date before the deadline.\n\nhttps://careerhub.io/fellowship\n\nCareerHub', 7 * H);
  mail(codehost, [me], '[CodeHost] Sudo email verification code', 'Here is your sudo authentication code:\n\n**86240617**\n\nThis code is valid for 15 minutes and can only be used once.\n\nIf you did not try to verify, you can ignore this email.\n\nThanks,\nThe CodeHost Team', 8 * H, { read: false });
  mail(campus, [me], 'akshay Reddy, Top Openings for you', 'Forward Deployed Intern, Data Analyst Intern and 12 more roles match your profile.\n\nView jobs: https://campusjobs.in/jobs', 10 * H);
  mail(shopkart, [me], 'Flash sale: up to 70% off', 'Grab the deals before they are gone!\n\n# Big Billion Days\n\nhttps://shopkart.in/sale', 1 * D);
  mail(digibank, [me], 'Transaction alert for your account', 'Rs 1,240.00 was debited from your account XX8063 on UPI. If this was not you, call 1800-000-000.', 1 * D + 2 * H);
  mail(linkup, [me], 'Your profile was viewed 12 times this week', 'See who viewed your profile: https://linkup.net/me/views', 1 * D + 3 * H);

  const v = mail(verify, [me], 'Verification Code - NovaCorp', '# Verify your email address\n\nThanks for verifying your akshay@gmai.app account!\n\n**Your code is: 547878**\n\nSincerely,\nNovaCorp\n\nThis message was sent from an unmonitored email address. Please do not reply to this message.', 5 * D);
  mail(verify, [me], 'Verification Code - NovaCorp', '# Verify your email address\n\nThanks for verifying your akshay@gmai.app account!\n\n**Your code is: 804678**\n\nSincerely,\nNovaCorp', 5 * D - 3 * H, { thread: v.threadId, inReplyTo: v.id });

  // Thread: support case with replies both ways.
  const t1 = mail(skyline, [me], 'Re: Request for Booking ID - SK28420278501031350', 'Dear Mr. Akshay,\n\nGreetings from Skyline Travel!\n\nThis email is regarding your booking ID: **SK28420278501031350**.\n\nWe acknowledge that you have already shared the alternate accommodation invoice with us, and we appreciate your cooperation.\n\nAs communicated in our previous email, we are willing to provide a **100% refund of your original booking amount in the form of Skyline Money** as a goodwill gesture.\n\nThe applicable redemption details are as follows:\n- **Flights & Hotels:** 100% redemption of Skyline Money.\n- **Train Bookings:** Up to Rs 10 per booking.\n- **Validity:** 60 days from the date of issuance.\n\nWe request you to kindly confirm your acceptance of this resolution so that we can proceed with the credit accordingly.\n\nBest regards,\nTeam Skyline', 14 * D);
  mail(me, [skyline], 'Re: Request for Booking ID - SK28420278501031350', 'Hello, I did not receive any refund yet. First I booked a stay, they refused to give me the hotel. I raised a support ticket via call and chat in your app; your team responded at 7 PM. Please check and update me.', 13 * D + 4 * H, { thread: t1.threadId, inReplyTo: t1.id });
  mail(skyline, [me], 'Re: Request for Booking ID - SK28420278501031350', 'Dear Akshay,\n\nThank you for reaching out to Skyline Travel. We have created a service request with reference number **14760167**.\n\nOur team is already reviewing the details and will get back to you with an update at the earliest.\n\nIf you need immediate help, our support team is available 24x7:\n\n📞 Call us: +91-11-0000-4444\n💬 Chat with us: https://skylinetravel.in/support\n\nThis is an automated acknowledgement email.\n\nWarm regards,\nTeam Skyline', 13 * D + 3 * H, { thread: t1.threadId, starred: true });

  // Thread: CareerHub, "Yes, I confirm."
  const t2 = mail(careerhub, [me], 'User needs to update resume on CareerHub', '##- Please type your reply above this line -##\n\nHi there,\n\nPlease confirm your email so we can help you with your account.', 9 * D);
  mail(me, [careerhub], 'Re: User needs to update resume on CareerHub', 'Yes, I confirm.', 9 * D - 2 * H, { thread: t2.threadId, inReplyTo: t2.id });
  mail(careerhub, [me], 'Re: User needs to update resume on CareerHub', 'Hi Akshay,\n\nThank you for reaching out and for your previous contributions to Project Stova.\n\nI have uploaded the updated resume you attached to your profile, replacing the older version. Your account is currently active and verified, and your updated background will be considered when your profile is reviewed for future opportunities.\n\nDebraj (CareerHub AI)', 9 * D - 6 * H, { thread: t2.threadId });

  mail(jayashree, [me], 'DOCUMENT BRIEFING SESSION INVITE!', 'Dear Candidate,\n\nYour first day is fast approaching, and we hope you are looking forward to getting started.\n\nWe are extending an invite to you for a Document briefing session, which will be dedicated to taking you through the process of mandatory document submission. The agenda is as follows:\n\n- Helping you understand what documents/forms are supposed to be submitted on or before Day 1\n- High level overview of the tools you need to access for document submission\n- Dos and Don\'ts of document submission\n- 30 mins of Q&A\n\n**Date:** Monday, November 9\n**Time:** 11:00 AM - 11:30 AM\n\nRegards,\nOnboarding Team', 10 * D, { starred: true, important: true, attachments: [png('image002.png', 48211), png('image005.png', 51200), pdf('Document_Guide.pdf', 820000)] });
  mail(priya, [me], 'Lunch tomorrow?', 'Hey akshay,\n\nAre you free for lunch tomorrow around 1? There is a new place near the office.\n\nPriya', 2 * D + 5 * H);
  mail(rahul, [me], 'Project report draft', 'Hi,\n\nI have attached the draft of the project report. Please review the second section and add your part by Friday.\n\nThanks,\nRahul', 3 * D, { attachments: [pdf('Project_Report_v2.pdf', 1250000)] });
  mail(cloudhost, [me], 'Deploy failed for gmai-server', 'We encountered an error while deploying your service.\n\nBuild command exited with code 1. Open the dashboard for logs: https://clouddeploy.dev/dashboard', 4 * D);
  mail(cloudhost, [me], 'Blueprint sync failed', 'Your blueprint sync failed. Check the logs and try again.', 4 * D + 1 * H);
  mail(campus, [me], 'akshay, you are missing job alerts', 'Your resume is outdated. Update it to get better job recommendations.\n\nhttps://campusjobs.in/profile', 6 * D);
  mail(shopkart, [me], 'Your order has shipped', 'Good news! Your order #SK-20931 is on its way and will arrive by Thursday.', 6 * D + 2 * H);
  mail(linkup, [me], 'Be the first to hear about new jobs', 'Set up job alerts for companies you follow.', 7 * D);
  mail(digibank, [me], 'Security alert: new sign-in', 'A new sign-in on Windows was detected. If this was you, no action is needed.', 8 * D);
  mail(lottery, [me], 'Congratulations!!! You have won Rs 50,00,000', 'Claim your prize now by sending your bank details and a processing fee.', 3 * D, { folder: 'spam' });
  mail(lottery, [me], 'Final notice: unclaimed prize', 'This is your last chance to claim the prize.', 6 * D, { folder: 'spam' });

  // Sent by me (some to colleagues, one unanswered).
  mail(me, [jayashree], 'UAN Card Details - CID', 'Hi,\n\nPlease find my UAN card attached.\n\nRegards,\nKalluri Akshay Reddy', 7 * D + 5 * H, { attachments: [pdf('epfo.pdf', 210000)] });
  mail(me, [priya], 'Notes from the meeting', 'Hi Priya,\n\nSharing the notes from today. Let me know if I missed anything.\n\nakshay', 11 * D);
  mail(madhavi, [me], 'Family function on Sunday', 'Hi akshay, don\'t forget the function on Sunday at 6 PM. Mom asked you to bring the sweets.', 12 * D);

  // A draft and labels.
  const draft = { id: id('msg'), threadId: id('thr'), from: addr(me), to: [addr(rahul)], cc: [], bcc: [], subject: 'Re: Project report draft', body: 'Hi Rahul, I added my part in section 2. Will', date: now - 2 * D, attachments: [], inReplyTo: null };
  db.messages.push(draft);
  db.items.push({ id: id('itm'), box: me.email, mid: draft.id, tid: draft.threadId, folder: 'drafts', category: 'primary', read: true, starred: false, important: false, labels: [] });
  db.labels.push({ id: id('lbl'), box: me.email, name: 'Work', color: '#1A73E8' }, { id: id('lbl'), box: me.email, name: 'Receipts', color: '#188038' });

  // A few mails for the other demo users so switching accounts shows real inboxes.
  mail(priya, [social], 'Post schedule for next week', 'Sharing the post schedule. Please review before Monday.', 1 * D);
  mail(shopkart, [social], 'Grow your store with ads', 'Reach more buyers with ShopKart Ads.', 2 * D);
  mail(me, [rahul], 'Re: Project report draft', 'Looks good, will add my part tonight.', 2 * D + 1 * H);
  mail(linkup, [priya], 'You appeared in 9 searches', 'See who is looking at your profile.', 1 * D);
  return db;
}

module.exports = { buildSeed, colorFor, DOMAIN };
