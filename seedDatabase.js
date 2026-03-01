const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const ProfessionalField = require('./models/ProfessionalField');
const Conference = require('./models/Conference');
const Paper = require('./models/Paper');
const Review = require('./models/Review');
const Notification = require('./models/Notification');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        // ── 1. Drop all collections ──────────────────────────────────────────
        console.log('\n🗑️  Dropping all collections...');
        try { await User.collection.drop(); } catch (_) { }
        try { await ProfessionalField.collection.drop(); } catch (_) { }
        try { await Conference.collection.drop(); } catch (_) { }
        try { await Paper.collection.drop(); } catch (_) { }
        try { await Review.collection.drop(); } catch (_) { }
        try { await Notification.collection.drop(); } catch (_) { }

        // Re-create indexes
        await User.init();
        await ProfessionalField.init();
        await Conference.init();
        await Paper.init();
        await Review.init();
        await Notification.init();
        console.log('   All collections dropped & indexes re-created.');

        // ── 2. Professional Fields ───────────────────────────────────────────
        console.log('\n📚 Creating Professional Fields...');
        const fieldAI = await ProfessionalField.create({ fieldName: 'Artificial Intelligence', description: 'Machine Learning, Deep Learning, NLP' });
        const fieldCS = await ProfessionalField.create({ fieldName: 'Cyber Security', description: 'Network Security, Cryptography, Ethical Hacking' });
        const fieldSE = await ProfessionalField.create({ fieldName: 'Software Engineering', description: 'Agile, DevOps, Code Quality, Architecture' });
        const fieldDB = await ProfessionalField.create({ fieldName: 'Data Science', description: 'Big Data, Analytics, Visualization' });
        const fieldNet = await ProfessionalField.create({ fieldName: 'Computer Networks', description: '5G, IoT, Distributed Systems' });

        // ── 3. Users ─────────────────────────────────────────────────────────
        console.log('\n👤 Creating Users...');

        // Secretary (main admin)
        const secretary = await User.create({
            name: 'Delojan Secretary',
            email: 'delojan1@gmail.com',
            password: 'password123',
            roles: ['Secretary'],
            affiliation: 'University of Colombo',
            country: 'Sri Lanka',
            isActive: true
        });

        // Editors
        const editor1 = await User.create({
            name: 'Charlie Editor',
            email: 'editor1@example.com',
            password: 'password123',
            roles: ['Editor'],
            affiliation: 'MIT',
            country: 'USA',
            isActive: true
        });

        const editor2 = await User.create({
            name: 'Emma Editor',
            email: 'editor2@example.com',
            password: 'password123',
            roles: ['Editor'],
            affiliation: 'Oxford University',
            country: 'UK',
            isActive: true
        });

        // Sub-Editors (each specialised in certain fields)
        const subEditor1 = await User.create({
            name: 'David SubEditor',
            email: 'subeditor1@example.com',
            password: 'password123',
            roles: ['SubEditor'],
            professionalFields: [fieldAI._id, fieldDB._id],
            affiliation: 'Stanford University',
            country: 'USA',
            isActive: true
        });

        const subEditor2 = await User.create({
            name: 'Fiona SubEditor',
            email: 'subeditor2@example.com',
            password: 'password123',
            roles: ['SubEditor'],
            professionalFields: [fieldCS._id, fieldNet._id],
            affiliation: 'ETH Zurich',
            country: 'Switzerland',
            isActive: true
        });

        // Reviewers
        const reviewer1 = await User.create({
            name: 'Bob Reviewer',
            email: 'reviewer1@example.com',
            password: 'password123',
            roles: ['Reviewer'],
            professionalFields: [fieldAI._id, fieldDB._id],
            affiliation: 'Carnegie Mellon',
            country: 'USA',
            isActive: true
        });

        const reviewer2 = await User.create({
            name: 'Grace Reviewer',
            email: 'reviewer2@example.com',
            password: 'password123',
            roles: ['Reviewer'],
            professionalFields: [fieldCS._id, fieldNet._id],
            affiliation: 'TU Berlin',
            country: 'Germany',
            isActive: true
        });

        const reviewer3 = await User.create({
            name: 'Henry Reviewer',
            email: 'reviewer3@example.com',
            password: 'password123',
            roles: ['Reviewer'],
            professionalFields: [fieldSE._id, fieldAI._id],
            affiliation: 'Imperial College London',
            country: 'UK',
            isActive: true
        });

        // Authors
        const author1 = await User.create({
            name: 'Alice Author',
            email: 'author1@example.com',
            password: 'password123',
            roles: ['Author'],
            professionalFields: [fieldAI._id],
            affiliation: 'IIT Bombay',
            country: 'India',
            isActive: true
        });

        const author2 = await User.create({
            name: 'Ivan Author',
            email: 'author2@example.com',
            password: 'password123',
            roles: ['Author'],
            professionalFields: [fieldCS._id, fieldNet._id],
            affiliation: 'NTU Singapore',
            country: 'Singapore',
            isActive: true
        });

        const author3 = await User.create({
            name: 'Julia Author',
            email: 'author3@example.com',
            password: 'password123',
            roles: ['Author'],
            professionalFields: [fieldSE._id, fieldDB._id],
            affiliation: 'Univ. of Melbourne',
            country: 'Australia',
            isActive: true
        });

        // Inactive user (to show deactivated state)
        const inactiveUser = await User.create({
            name: 'Karl Inactive',
            email: 'inactive@example.com',
            password: 'password123',
            roles: ['Author'],
            affiliation: 'Unknown',
            country: 'NA',
            isActive: false
        });

        // Reviewer with multiple professional fields
        const multiRole = await User.create({
            name: 'Laura Reviewer',
            email: 'multirole@example.com',
            password: 'password123',
            roles: ['Reviewer'],
            professionalFields: [fieldDB._id, fieldSE._id],
            affiliation: 'KAIST',
            country: 'South Korea',
            isActive: true
        });

        // ── 4. Link Sub-Editors to Fields ──────────────────────────────────
        fieldAI.subEditors = [subEditor1._id];
        fieldDB.subEditors = [subEditor1._id];
        fieldCS.subEditors = [subEditor2._id];
        fieldNet.subEditors = [subEditor2._id];
        await fieldAI.save(); await fieldDB.save();
        await fieldCS.save(); await fieldNet.save();

        // ── 5. Conferences ───────────────────────────────────────────────────
        console.log('\n🏛️  Creating Conferences...');

        // Conference A: submission_open (active, future deadline)
        const confA = await Conference.create({
            title: 'International Conference on Artificial Intelligence 2026',
            acronym: 'ICAI-26',
            description: 'A premier venue for AI research spanning machine learning, NLP, and computer vision.',
            startDate: daysFromNow(60),
            endDate: daysFromNow(63),
            submissionDeadline: daysFromNow(30),
            reviewDeadline: daysFromNow(50),
            fields: [fieldAI._id, fieldDB._id],
            status: 'submission_open',
            sessions: [
                { title: 'Keynote & Opening', scheduledTime: daysFromNow(60) },
                { title: 'Deep Learning Track', scheduledTime: daysFromNow(61) },
                { title: 'NLP & Vision Track', scheduledTime: daysFromNow(62) }
            ],
            createdBy: secretary._id
        });

        // Conference B: reviewing phase
        const confB = await Conference.create({
            title: 'Symposium on Cyber Security & Networks 2026',
            acronym: 'SCSN-26',
            description: 'Bringing together leading researchers in cybersecurity and distributed networks.',
            startDate: daysFromNow(45),
            endDate: daysFromNow(47),
            submissionDeadline: daysFromNow(-5),  // closed
            reviewDeadline: daysFromNow(20),
            fields: [fieldCS._id, fieldNet._id],
            status: 'reviewing',
            sessions: [
                { title: 'Cryptography Session', scheduledTime: daysFromNow(45) },
                { title: 'IoT & 5G Session', scheduledTime: daysFromNow(46) }
            ],
            createdBy: secretary._id
        });

        // Conference C: decision_made (completed reviews)
        const confC = await Conference.create({
            title: 'Workshop on Software Engineering Best Practices',
            acronym: 'WSEBP-26',
            description: 'A focused workshop on modern software development methodologies.',
            startDate: daysFromNow(10),
            endDate: daysFromNow(11),
            submissionDeadline: daysFromNow(-20),
            reviewDeadline: daysFromNow(-5),
            fields: [fieldSE._id, fieldDB._id],
            status: 'decision_made',
            sessions: [
                { title: 'Agile Practices Session', scheduledTime: daysFromNow(10) }
            ],
            createdBy: secretary._id
        });

        // ── 6. Papers ────────────────────────────────────────────────────────
        console.log('\n📄 Creating Papers...');

        // --------- Conference A papers ---------
        // submitted (freshly submitted, no reviewers yet)
        const paperA1 = await Paper.create({
            title: 'Transformer Architectures for Long-Context Reasoning',
            abstract: 'We propose a novel transformer modification that efficiently handles context windows exceeding 100k tokens without quadratic memory growth.',
            keywords: ['Transformer', 'Long Context', 'Attention', 'LLM'],
            authors: [author1._id],
            conference: confA._id,
            field: fieldAI._id,
            status: 'submitted',
            fileName: 'transformer_long_ctx.pdf',
            fileUrl: '/uploads/transformer_long_ctx.pdf'
        });

        // submitted — multi-author
        const paperA2 = await Paper.create({
            title: 'Federated Learning with Differential Privacy',
            abstract: 'A privacy-preserving federated learning framework that provides formal differential privacy guarantees across heterogeneous clients.',
            keywords: ['Federated Learning', 'Differential Privacy', 'Distributed ML'],
            authors: [author1._id, multiRole._id],
            conference: confA._id,
            field: fieldAI._id,
            status: 'submitted',
            fileName: 'federated_dp.pdf',
            fileUrl: '/uploads/federated_dp.pdf'
        });

        // under_review — assigned to reviewers
        const paperA3 = await Paper.create({
            title: 'Graph Neural Networks for Drug Discovery',
            abstract: 'We apply GNNs to molecular graphs to predict drug-target binding affinities with state-of-the-art accuracy on benchmark datasets.',
            keywords: ['GNN', 'Drug Discovery', 'Graph Learning', 'Bioinformatics'],
            authors: [author3._id],
            conference: confA._id,
            field: fieldDB._id,
            status: 'under_review',
            fileName: 'gnn_drug_discovery.pdf',
            fileUrl: '/uploads/gnn_drug_discovery.pdf'
        });

        // revision_required
        const paperA4 = await Paper.create({
            title: 'Explainable AI in Medical Imaging Diagnosis',
            abstract: 'We present an explainability framework for deep CNN models used in radiology, providing clinician-readable justifications for predictions.',
            keywords: ['XAI', 'Medical Imaging', 'CNN', 'Explainability'],
            authors: [author1._id, author3._id],
            conference: confA._id,
            field: fieldAI._id,
            status: 'revision_required',
            fileName: 'xai_medical.pdf',
            fileUrl: '/uploads/xai_medical.pdf'
        });

        // --------- Conference B papers ---------
        // under_review
        const paperB1 = await Paper.create({
            title: 'Zero-Trust Architecture for Enterprise Networks',
            abstract: 'A comprehensive evaluation of zero-trust security models in large-scale enterprise environments, with practical deployment guidelines.',
            keywords: ['Zero Trust', 'Network Security', 'Enterprise', 'IAM'],
            authors: [author2._id],
            conference: confB._id,
            field: fieldCS._id,
            status: 'under_review',
            fileName: 'zero_trust.pdf',
            fileUrl: '/uploads/zero_trust.pdf'
        });

        // under_review
        const paperB2 = await Paper.create({
            title: 'Securing IoT Device Communication with Lightweight Cryptography',
            abstract: 'We propose a lightweight cryptographic protocol optimised for resource-constrained IoT devices, reducing power consumption by 40%.',
            keywords: ['IoT', 'Lightweight Cryptography', 'AEAD', 'Embedded Systems'],
            authors: [author2._id, author1._id],
            conference: confB._id,
            field: fieldNet._id,
            status: 'under_review',
            fileName: 'iot_crypto.pdf',
            fileUrl: '/uploads/iot_crypto.pdf'
        });

        // submitted
        const paperB3 = await Paper.create({
            title: '5G Network Slicing for Ultra-Low Latency Applications',
            abstract: 'Dynamic network slicing strategies for 5G infrastructure targeting sub-1ms latency for real-time control applications.',
            keywords: ['5G', 'Network Slicing', 'Latency', 'URLLC'],
            authors: [author2._id],
            conference: confB._id,
            field: fieldNet._id,
            status: 'submitted',
            fileName: '5g_slicing.pdf',
            fileUrl: '/uploads/5g_slicing.pdf'
        });

        // --------- Conference C papers (decision_made conference) ---------
        // accepted
        const paperC1 = await Paper.create({
            title: 'Microservices Migration: Patterns and Anti-Patterns',
            abstract: 'An empirical study of 120 enterprise microservices migrations, identifying the top 8 success patterns and 6 critical anti-patterns.',
            keywords: ['Microservices', 'Migration', 'Software Architecture', 'DevOps'],
            authors: [author3._id],
            conference: confC._id,
            field: fieldSE._id,
            status: 'accepted',
            finalDecision: 'Paper demonstrates strong empirical contributions and clear practical value.',
            decisionBy: editor1._id,
            decisionDate: daysFromNow(-3)
        });

        // accepted
        const paperC2 = await Paper.create({
            title: 'CI/CD Pipeline Quality Gates: A Systematic Review',
            abstract: 'A systematic literature review of 85 studies on quality gate strategies in CI/CD pipelines, with an evidence-based recommendation framework.',
            keywords: ['CI/CD', 'Quality Gates', 'DevOps', 'SLR'],
            authors: [author3._id, multiRole._id],
            conference: confC._id,
            field: fieldSE._id,
            status: 'accepted',
            finalDecision: 'Comprehensive and well-structured review. Accepted with minor formatting revisions.',
            decisionBy: editor2._id,
            decisionDate: daysFromNow(-4)
        });

        // rejected
        const paperC3 = await Paper.create({
            title: 'Waterfall Model Superiority in 2026',
            abstract: 'We argue that waterfall remains a superior model for software development in all contexts.',
            keywords: ['Waterfall', 'SDLC', 'Project Management'],
            authors: [inactiveUser._id],
            conference: confC._id,
            field: fieldSE._id,
            status: 'rejected',
            finalDecision: 'Claims are unsupported by evidence. Contradicts a large body of accepted literature. Rejected.',
            decisionBy: editor1._id,
            decisionDate: daysFromNow(-2)
        });

        // revision_required
        const paperC4 = await Paper.create({
            title: 'Real-Time Data Pipeline Design with Apache Kafka',
            abstract: 'Design and benchmark of a high-throughput, fault-tolerant real-time data pipeline using Apache Kafka and Flink.',
            keywords: ['Kafka', 'Flink', 'Data Pipeline', 'Real-Time'],
            authors: [multiRole._id],
            conference: confC._id,
            field: fieldDB._id,
            status: 'revision_required',
            finalDecision: 'Promising work. Requires additional benchmarks against competing solutions before acceptance.',
            decisionBy: editor2._id,
            decisionDate: daysFromNow(-1)
        });

        // ── 7. Assign papers to sessions ──────────────────────────────────────
        confA.sessions[1].papers = [paperA3._id, paperA4._id]; // Deep Learning Track
        confA.sessions[2].papers = [paperA1._id, paperA2._id]; // NLP & Vision Track
        await confA.save();

        confB.sessions[0].papers = [paperB1._id];    // Crypto Session
        confB.sessions[1].papers = [paperB2._id, paperB3._id]; // IoT & 5G
        await confB.save();

        confC.sessions[0].papers = [paperC1._id, paperC2._id]; // Agile Session
        await confC.save();

        // ── 8. Reviews ────────────────────────────────────────────────────────
        console.log('\n📝 Creating Reviews...');

        // paperA3: two reviews (both submitted)
        const revA3_1 = await Review.create({
            paper: paperA3._id, reviewer: reviewer1._id,
            recommendation: 'accept',
            score: 88,
            commentsToAuthor: 'Strong methodology and well-presented results. Minor clarity issues in Section 4.',
            confidentialComments: 'Good paper, recommend accept with minor revisions.',
            status: 'submitted',
            submittedAt: daysFromNow(-3)
        });

        const revA3_2 = await Review.create({
            paper: paperA3._id, reviewer: reviewer3._id,
            recommendation: 'minor_revision',
            score: 76,
            commentsToAuthor: 'The benchmark comparisons need updating. Please include baselines from 2024 onward.',
            confidentialComments: 'Solid contribution but evaluation section is slightly weak.',
            status: 'submitted',
            submittedAt: daysFromNow(-2)
        });

        // paperA4: two reviews — revision required
        await Review.create({
            paper: paperA4._id, reviewer: reviewer1._id,
            recommendation: 'major_revision',
            score: 62,
            commentsToAuthor: 'The explainability metrics in Section 3 need rigorous justification. Add user study results.',
            confidentialComments: 'Interesting topic but evaluation is incomplete.',
            status: 'submitted',
            submittedAt: daysFromNow(-5)
        });

        await Review.create({
            paper: paperA4._id, reviewer: reviewer3._id,
            recommendation: 'minor_revision',
            score: 71,
            commentsToAuthor: 'Good clinical analysis. Please expand the related work section.',
            confidentialComments: 'Worth accepting after revisions.',
            status: 'submitted',
            submittedAt: daysFromNow(-4)
        });

        // paperB1: one submitted review, one still assigned
        await Review.create({
            paper: paperB1._id, reviewer: reviewer2._id,
            recommendation: 'strong_accept',
            score: 94,
            commentsToAuthor: 'Excellent coverage of the zero-trust model. Well-written and timely.',
            confidentialComments: 'One of the best submissions this cycle.',
            status: 'submitted',
            submittedAt: daysFromNow(-1)
        });

        await Review.create({
            paper: paperB1._id, reviewer: reviewer3._id,
            recommendation: null,
            score: null,
            commentsToAuthor: '',
            confidentialComments: '',
            status: 'assigned'
            // Not yet submitted
        });

        // paperB2: two submitted reviews
        await Review.create({
            paper: paperB2._id, reviewer: reviewer2._id,
            recommendation: 'accept',
            score: 82,
            commentsToAuthor: 'Well-designed protocol. The 40% power saving claim is convincing.',
            confidentialComments: 'Recommend acceptance.',
            status: 'submitted',
            submittedAt: daysFromNow(-2)
        });

        await Review.create({
            paper: paperB2._id, reviewer: reviewer1._id,
            recommendation: 'minor_revision',
            score: 78,
            commentsToAuthor: 'Please compare against ASCON and other NIST LWC finalists.',
            confidentialComments: 'Solid paper, needs better related work.',
            status: 'submitted',
            submittedAt: daysFromNow(-1)
        });

        // paperC1 (accepted): two strong accept reviews
        await Review.create({
            paper: paperC1._id, reviewer: reviewer3._id,
            recommendation: 'strong_accept',
            score: 95,
            commentsToAuthor: 'Outstanding empirical study. Clear writing and actionable insights.',
            confidentialComments: 'Top paper of the batch.',
            status: 'submitted',
            submittedAt: daysFromNow(-8)
        });

        await Review.create({
            paper: paperC1._id, reviewer: reviewer1._id,
            recommendation: 'accept',
            score: 89,
            commentsToAuthor: 'Very well structured. Minor typos in Section 2.',
            confidentialComments: 'Accept.',
            status: 'submitted',
            submittedAt: daysFromNow(-7)
        });

        // paperC2 (accepted): two accept reviews
        await Review.create({
            paper: paperC2._id, reviewer: reviewer3._id,
            recommendation: 'accept',
            score: 86,
            commentsToAuthor: 'Comprehensive review methodology. The evidence framework is a solid contribution.',
            confidentialComments: 'Recommend acceptance.',
            status: 'submitted',
            submittedAt: daysFromNow(-6)
        });

        await Review.create({
            paper: paperC2._id, reviewer: reviewer2._id,
            recommendation: 'minor_revision',
            score: 81,
            commentsToAuthor: 'Good work. Formatting of Table 3 needs improvement.',
            confidentialComments: 'Minor issues only.',
            status: 'submitted',
            submittedAt: daysFromNow(-5)
        });

        // paperC3 (rejected): two reject reviews
        await Review.create({
            paper: paperC3._id, reviewer: reviewer1._id,
            recommendation: 'reject',
            score: 22,
            commentsToAuthor: 'Claims contradict decades of software engineering literature. No empirical support provided.',
            confidentialComments: 'Reject.',
            status: 'submitted',
            submittedAt: daysFromNow(-6)
        });

        await Review.create({
            paper: paperC3._id, reviewer: reviewer3._id,
            recommendation: 'reject',
            score: 18,
            commentsToAuthor: 'This paper does not meet the scientific standards required for publication.',
            confidentialComments: 'Clear reject.',
            status: 'submitted',
            submittedAt: daysFromNow(-5)
        });

        // paperC4 (revision_required): mixed reviews
        await Review.create({
            paper: paperC4._id, reviewer: reviewer1._id,
            recommendation: 'minor_revision',
            score: 75,
            commentsToAuthor: 'Good practical contribution. Need to compare against Spark Streaming and Faust.',
            confidentialComments: 'Needs more benchmarks.',
            status: 'submitted',
            submittedAt: daysFromNow(-4)
        });

        await Review.create({
            paper: paperC4._id, reviewer: reviewer2._id,
            recommendation: 'major_revision',
            score: 60,
            commentsToAuthor: 'The fault-tolerance evaluation is incomplete. Please test with node failures.',
            confidentialComments: 'Too many gaps in evaluation.',
            status: 'submitted',
            submittedAt: daysFromNow(-3)
        });

        // ── 9. Notifications ─────────────────────────────────────────────────
        console.log('\n🔔 Creating Notifications...');

        // Author notifications
        const notifs = [
            // submission confirmations
            { user: author1._id, title: 'Paper Submitted', message: `Your paper "${paperA1.title}" has been successfully submitted to ICAI-26.`, type: 'submission', relatedPaper: paperA1._id, read: true },
            { user: author1._id, title: 'Paper Submitted', message: `Your paper "${paperA2.title}" has been successfully submitted to ICAI-26.`, type: 'submission', relatedPaper: paperA2._id, read: true },
            { user: author1._id, title: 'Paper Under Review', message: `"${paperA4.title}" is now under review.`, type: 'submission', relatedPaper: paperA4._id, read: false },
            { user: author1._id, title: 'Revision Required', message: `"${paperA4.title}" requires revision. Please check the reviewer comments.`, type: 'decision', relatedPaper: paperA4._id, read: false },
            { user: author2._id, title: 'Paper Submitted', message: `Your paper "${paperB1.title}" has been received and is now under review.`, type: 'submission', relatedPaper: paperB1._id, read: true },
            { user: author2._id, title: 'Paper Submitted', message: `Your paper "${paperB3.title}" has been successfully submitted.`, type: 'submission', relatedPaper: paperB3._id, read: false },
            { user: author3._id, title: 'Paper Accepted! 🎉', message: `Congratulations! "${paperC1.title}" has been accepted for WSEBP-26.`, type: 'decision', relatedPaper: paperC1._id, read: false },
            { user: author3._id, title: 'Paper Accepted! 🎉', message: `Congratulations! "${paperC2.title}" has been accepted for WSEBP-26.`, type: 'decision', relatedPaper: paperC2._id, read: false },
            { user: multiRole._id, title: 'Paper Revision Required', message: `"${paperC4.title}" requires revision before a final decision can be made.`, type: 'decision', relatedPaper: paperC4._id, read: false },
            // Reviewer notifications
            { user: reviewer1._id, title: 'New Review Assignment', message: `You have been assigned to review "${paperA3.title}" for ICAI-26.`, type: 'review_assignment', relatedPaper: paperA3._id, read: true },
            { user: reviewer1._id, title: 'New Review Assignment', message: `You have been assigned to review "${paperA4.title}" for ICAI-26.`, type: 'review_assignment', relatedPaper: paperA4._id, read: true },
            { user: reviewer1._id, title: 'New Review Assignment', message: `You have been assigned to review "${paperB2.title}" for SCSN-26.`, type: 'review_assignment', relatedPaper: paperB2._id, read: false },
            { user: reviewer2._id, title: 'New Review Assignment', message: `You have been assigned to review "${paperB1.title}" for SCSN-26.`, type: 'review_assignment', relatedPaper: paperB1._id, read: true },
            { user: reviewer2._id, title: 'New Review Assignment', message: `You have been assigned to review "${paperB2.title}" for SCSN-26.`, type: 'review_assignment', relatedPaper: paperB2._id, read: false },
            { user: reviewer3._id, title: 'New Review Assignment', message: `You have been assigned to review "${paperB1.title}" for SCSN-26.`, type: 'review_assignment', relatedPaper: paperB1._id, read: false },
            { user: reviewer3._id, title: 'Review Deadline Reminder', message: 'The review deadline for SCSN-26 is in 20 days. Please complete your pending reviews.', type: 'deadline', read: false },
            // Secretary notifications
            { user: secretary._id, title: 'New Paper Submitted', message: `"${paperA1.title}" has been submitted to ICAI-26.`, type: 'submission', relatedPaper: paperA1._id, read: true },
            { user: secretary._id, title: 'New Paper Submitted', message: `"${paperB3.title}" has been submitted to SCSN-26.`, type: 'submission', relatedPaper: paperB3._id, read: false },
            { user: secretary._id, title: 'Submission Deadline Passed', message: 'The submission deadline for SCSN-26 has now passed.', type: 'deadline', read: false },
        ];

        for (const n of notifs) {
            await Notification.create(n);
        }

        // ── 10. Print summary ─────────────────────────────────────────────────
        console.log('\n✅ Database seeded successfully!');
        console.log('══════════════════════════════════════════════════════════');
        console.log('  LOGIN ACCOUNTS (all passwords: password123)');
        console.log('══════════════════════════════════════════════════════════');
        console.log('  SECRETARY');
        console.log('    delojan1@gmail.com          — Secretary');
        console.log('  EDITORS');
        console.log('    editor1@example.com         — Editor (Charlie)');
        console.log('    editor2@example.com         — Editor (Emma)');
        console.log('  SUB-EDITORS');
        console.log('    subeditor1@example.com      — Sub Editor (AI + Data Science)');
        console.log('    subeditor2@example.com      — Sub Editor (Cyber Security + Networks)');
        console.log('  REVIEWERS');
        console.log('    reviewer1@example.com       — Reviewer (AI + Data Science)');
        console.log('    reviewer2@example.com       — Reviewer (Cyber Security + Networks)');
        console.log('    reviewer3@example.com       — Reviewer (Software Eng. + AI)');
        console.log('  AUTHORS');
        console.log('    author1@example.com         — Author (AI papers in ICAI-26)');
        console.log('    author2@example.com         — Author (Security papers in SCSN-26)');
        console.log('    author3@example.com         — Author (SE papers in WSEBP-26)');
        console.log('    multirole@example.com       — Reviewer + Author');
        console.log('    inactive@example.com        — Inactive account');
        console.log('══════════════════════════════════════════════════════════');
        console.log('  CONFERENCES');
        console.log('    ICAI-26  — submission_open  (3 submitted, 1 under_review, 1 revision)');
        console.log('    SCSN-26  — reviewing        (1 submitted, 2 under_review)');
        console.log('    WSEBP-26 — decision_made    (2 accepted, 1 rejected, 1 revision)');
        console.log('══════════════════════════════════════════════════════════');
        console.log('  PAPERS  (11 total across all conferences & statuses)');
        console.log('    submitted: 5 | under_review: 3 | revision_required: 2');
        console.log('    accepted: 2  | rejected: 1');
        console.log('══════════════════════════════════════════════════════════');
        console.log('  REVIEWS  (14 total, all recommendation types covered)');
        console.log('    strong_accept: 2 | accept: 4 | minor_revision: 4');
        console.log('    major_revision: 2 | reject: 2');
        console.log('══════════════════════════════════════════════════════════');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
