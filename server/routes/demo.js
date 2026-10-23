/**
 * Demo route.
 * Provides pre-populated demo sessions with realistic Indonesian & English YouTube comments
 * (including genuine examples of judol / spam / toxic comments, questions, and compliments)
 * so that the user and evaluators can immediately experience the full dashboard.
 */
const express = require('express');
const router = express.Router();
const sessionService = require('../services/session');

const DEMO_COMMENTS = [
  {
    commentId: 'c_demo_01',
    authorDisplayName: 'Rian Pratama',
    text: 'Bang, tutorial penjelasannya runtut banget dan gampang dipahami. Ditunggu part 2 kelanjutannya!',
    likeCount: 428,
    publishedAt: '2026-10-18T10:15:00Z',
    category: 'positive',
    sentiment: 'positive',
    riskTags: [],
    confidence: 0.98,
    explanation: 'Expresses sincere appreciation and encourages follow-up content.',
  },
  {
    commentId: 'c_demo_02',
    authorDisplayName: 'SLOT GACOR MAXWIN 88',
    text: 'MODAL RECEH BISA WD JUTAAN RUPIAH! DAFTAR SEKARANG DI LINK BIO KAMI RTP 99% JP PASTI PECAH KAK!! WA: 081239847192',
    likeCount: 2,
    publishedAt: '2026-10-18T10:22:00Z',
    category: 'negative',
    sentiment: 'negative',
    riskTags: ['judol', 'spam'],
    confidence: 0.99,
    explanation: 'Unsolicited online gambling (judi online / slot) advertisement with spam contact numbers.',
  },
  {
    commentId: 'c_demo_03',
    authorDisplayName: 'Siti Nurhaliza',
    text: 'Bisa tolong bahas cara integrasi backend Express sama SQLite atau Postgres gak min? Mau buat skripsi nih.',
    likeCount: 89,
    publishedAt: '2026-10-18T11:05:00Z',
    category: 'question',
    sentiment: 'neutral',
    riskTags: [],
    confidence: 0.95,
    explanation: 'Audience content request asking for database integration tutorial for thesis.',
  },
  {
    commentId: 'c_demo_04',
    authorDisplayName: 'HaterAnon99',
    text: 'Konten sampah gini aja ditonton, suaranya cempreng bikin sakit kuping. Dasar pembuat konten ga guna!',
    likeCount: 1,
    publishedAt: '2026-10-18T12:40:00Z',
    category: 'negative',
    sentiment: 'negative',
    riskTags: ['toxic', 'harassment'],
    confidence: 0.94,
    explanation: 'Ad-hominem insult directed at creator with offensive derogatory remarks.',
  },
  {
    commentId: 'c_demo_05',
    authorDisplayName: 'Budi Santoso',
    text: 'Saran dong bang, mic-nya agak kekecilan di menit 04:20. Tapi pembahasannya daging semua!',
    likeCount: 56,
    publishedAt: '2026-10-18T13:10:00Z',
    category: 'suggestion',
    sentiment: 'positive',
    riskTags: [],
    confidence: 0.91,
    explanation: 'Constructive feedback on audio level while praising overall video quality.',
  },
  {
    commentId: 'c_demo_06',
    authorDisplayName: 'AGEN TOGEL RESMI VIP',
    text: 'BOCORAN HK HARI INI PASTI TEMBUS 4D 3D 2D. KLIK LINK DI KOMEN PIN GACOR MALAM INI BOSKU',
    likeCount: 0,
    publishedAt: '2026-10-18T14:02:00Z',
    category: 'negative',
    sentiment: 'negative',
    riskTags: ['judol', 'spam'],
    confidence: 0.99,
    explanation: 'Lottery/gambling (togel) promotion and scam link redirection.',
  },
  {
    commentId: 'c_demo_07',
    authorDisplayName: 'Fajar Kurniawan',
    text: 'Audio visualnya rapi banget bang, editingnya aesthetic. Boleh tau software editnya pake apa?',
    likeCount: 34,
    publishedAt: '2026-10-18T14:30:00Z',
    category: 'question',
    sentiment: 'positive',
    riskTags: [],
    confidence: 0.93,
    explanation: 'Complimentary inquiry about video editing software.',
  },
  {
    commentId: 'c_demo_08',
    authorDisplayName: 'CryptoBot_FastEarn',
    text: 'I made $4,500 in 2 days thanks to Mr. Alexander telegram channel! Check profile info for details 🔥',
    likeCount: 3,
    publishedAt: '2026-10-18T15:00:00Z',
    category: 'negative',
    sentiment: 'negative',
    riskTags: ['spam'],
    confidence: 0.97,
    explanation: 'Classic automated financial scam bot soliciting Telegram groups.',
  },
  {
    commentId: 'c_demo_09',
    authorDisplayName: 'Dewi Lestari',
    text: 'Format pembahasannya to the point banget, ga bertele-tele. Sangat membantu buat pemula kayak saya.',
    likeCount: 112,
    publishedAt: '2026-10-18T15:20:00Z',
    category: 'positive',
    sentiment: 'positive',
    riskTags: [],
    confidence: 0.96,
    explanation: 'Positive testimonial praising concise pacing and educational clarity.',
  },
  {
    commentId: 'c_demo_10',
    authorDisplayName: 'DarkWebLover',
    text: 'Cari jasa doxxing dan hack akun IG murah amanah cek bio kami!',
    likeCount: 0,
    publishedAt: '2026-10-18T16:00:00Z',
    category: 'negative',
    sentiment: 'negative',
    riskTags: ['inappropriate', 'spam'],
    confidence: 0.95,
    explanation: 'Illegal hacking/doxxing solicitation.',
  },
];

const DEMO_RECOMMENDATIONS = [
  {
    title: 'Tutorial Lengkap: Mengintegrasikan Express.js dengan PostgreSQL & SQLite untuk Pemula',
    topic: 'Backend Database Integration',
    angle: 'Hands-on practical coding tutorial addressing audience thesis & project questions',
    reason: 'Banyak audiens menanyakan cara menghubungkan backend dengan database (skripsi/proyek nyata) setelah video arsitektur sebelumnya.',
    relevantCommentCount: 42,
    priority: 'high',
    outline: [
      'Setup PostgreSQL & SQLite dengan Node.js Express',
      'Membuat migrasi dan skema tabel relasional',
      'Implementasi Connection Pool & Error Handling',
      'Testing CRUD endpoints menggunakan Postman/Thunder Client',
    ],
    audienceTopics: ['Database Postgres/SQLite', 'Kebutuhan Skripsi', 'Backend Architecture'],
  },
  {
    title: 'Behind the Scenes & Setup Audio/Video: Tools Editing & Gear 2026',
    topic: 'Production Gear & Editing Workflow',
    angle: 'Creator lifestyle & setup reveal answering frequent editing software inquiries',
    reason: 'Komentar audiens memuji kualitas visual aesthetic dan menanyakan software serta gear yang digunakan.',
    relevantCommentCount: 28,
    priority: 'medium',
    outline: [
      'Breakdown workflow editing dan preset color grading',
      'Setup microphone & audio compression di OBS/DaVinci',
      'Tips lighting budget bersahabat untuk pemula',
    ],
    audienceTopics: ['Software Editing', 'Mic & Audio Setup', 'Color Grading'],
  },
];

router.post('/load-sample', (req, res) => {
  try {
    const session = sessionService.createSession(
      'dQw4w9WgXcQ',
      'Mastering Full-Stack Web Development: From Architecture to Production',
      'Tech Academy Indonesia'
    );

    session.comments = DEMO_COMMENTS.map(c => ({
      commentId: c.commentId,
      text: c.text,
      authorDisplayName: c.authorDisplayName,
      publishedAt: c.publishedAt,
      likeCount: c.likeCount,
    }));

    session.analysis = DEMO_COMMENTS.map(c => ({
      ...c,
      _text: c.text,
      moderationStatus: 'pending',
    }));

    session.recommendations = DEMO_RECOMMENDATIONS;

    res.json({
      success: true,
      sessionId: session.id,
      videoInfo: {
        videoId: session.videoId,
        title: session.videoTitle,
        channelTitle: session.channelTitle,
        publishedAt: '2026-10-18T08:00:00Z',
        viewCount: 154200,
        likeCount: 12400,
        commentCount: 840,
      },
      recommendations: DEMO_RECOMMENDATIONS,
      message: 'Demo dataset loaded successfully into active session.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load demo data', message: error.message });
  }
});

module.exports = router;
