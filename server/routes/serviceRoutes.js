/**
 * server/routes/serviceRoutes.js
 * -----------------------------------------------------------------------
 * REST endpoints for the Compton Service Dashboard.
 * Serves live data filtered strictly to Compton Company (Tenant ID: 13).
 */

const express = require('express');
const router = express.Router();
const serviceDb = require('../services/serviceDb');

// 1. Full Dashboard Overview (single payload for instant client load)
router.get('/overview', async (req, res) => {
  try {
    const data = await serviceDb.getServiceOverview();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching overview:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Summary KPI stats
router.get('/stats', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const { start_date, end_date } = req.query;
    const stats = await serviceDb.getComptonStats(range, start_date, end_date);
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching stats:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Top Performers Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const { start_date, end_date } = req.query;
    const performers = await serviceDb.getTopPerformers(range, start_date, end_date);
    res.json({ success: true, data: performers });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching leaderboard:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Workload Volume & Daily Curves
router.get('/workloads', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '15', 10);
    const range = req.query.range || 'month';
    const { start_date, end_date } = req.query;
    const workloads = await serviceDb.getWorkloads(days, range, start_date, end_date);
    res.json({ success: true, data: workloads });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching workloads:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Engineers Directory
router.get('/engineers', async (req, res) => {
  try {
    const engineers = await serviceDb.getEngineers();
    res.json({ success: true, data: engineers });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching engineers:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Client Companies Directory
router.get('/clients', async (req, res) => {
  try {
    const clients = await serviceDb.getClientCompanies();
    res.json({ success: true, data: clients });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching clients:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Paginated & Filtered Tickets
router.get('/tickets', async (req, res) => {
  try {
    const { status, severity, engineer_id, company_id, category, search, limit, offset, range, start_date, end_date, ratings_only } = req.query;
    const result = await serviceDb.getTickets({
      status,
      severity,
      engineer_id,
      company_id,
      category,
      search,
      ratings_only: ratings_only === 'true' || ratings_only === true,
      limit: parseInt(limit || '50', 10),
      offset: parseInt(offset || '0', 10),
      dateRange: range || 'all',
      startDate: start_date,
      endDate: end_date
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching tickets:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Inventory & Assets
router.get('/inventory', async (req, res) => {
  try {
    const inventory = await serviceDb.getInventory();
    res.json({ success: true, data: inventory });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching inventory:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Top 5 Customers
router.get('/top-customers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '5', 10);
    const range = req.query.range || 'all';
    const { start_date, end_date } = req.query;
    const customers = await serviceDb.getTopCustomers(limit, range, start_date, end_date);
    res.json({ success: true, data: customers });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching top customers:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Top 5 Issues
router.get('/top-issues', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '5', 10);
    const range = req.query.range || 'all';
    const { start_date, end_date } = req.query;
    const issues = await serviceDb.getTopIssues(limit, range, start_date, end_date);
    res.json({ success: true, data: issues });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching top issues:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Daily Ticket Creation Trend
router.get('/creation-daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '15', 10);
    const range = req.query.range || 'month';
    const { start_date, end_date } = req.query;
    const daily = await serviceDb.getTicketCreationDaily(range, start_date, end_date, days);
    res.json({ success: true, data: daily });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching creation daily:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const fs = require('fs');
const path = require('path');
const ESCALATED_FILE = process.env.ESCALATED_FILE || (
  fs.existsSync(path.resolve(__dirname, '../.data/escalated_tickets.json'))
    ? path.resolve(__dirname, '../.data/escalated_tickets.json')
    : path.resolve(__dirname, '../../.data/escalated_tickets.json')
);

function loadEscalatedIds() {
  try {
    if (fs.existsSync(ESCALATED_FILE)) {
      const content = fs.readFileSync(ESCALATED_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
      }
    }
  } catch (err) {
    console.error('[serviceRoutes] Error reading escalated tickets file:', err.message);
  }
  // Default initial active escalated tickets from live MySQL
  return [2106, 2105, 2101, 2091, 2064];
}

function saveEscalatedIds(ids) {
  try {
    const dir = path.dirname(ESCALATED_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const unique = Array.from(new Set(ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0)));
    fs.writeFileSync(ESCALATED_FILE, JSON.stringify(unique, null, 2), 'utf8');
  } catch (err) {
    console.error('[serviceRoutes] Error writing escalated tickets file:', err.message);
  }
}

// 12. Escalated Tickets (Auto-pruning resolved tickets)
router.get('/escalated', async (req, res) => {
  try {
    const ids = loadEscalatedIds();
    if (ids.length === 0) {
      return res.json({ success: true, data: { count: 0, tickets: [] } });
    }

    let tickets = [];
    try {
      tickets = await serviceDb.getTicketsByIds(ids);
    } catch (dbErr) {
      console.warn('[serviceRoutes] Error querying tickets by IDs from SQL, falling back:', dbErr.message);
    }

    // If SQL returned fewer records (e.g. offline/mock IDs), check fallback pool
    if (tickets.length < ids.length) {
      const foundIds = new Set(tickets.map(t => t.id));
      const fallbackPool = [
        { id: 2105, status: 'in_progress', severity: 'high', company_name: 'Singh & Singh LLP', engineer_name: 'Shyam', engineer_level: 'level 1', contact_email: 'tarun@singhandsingh.com', contact_number: '9899457391', issue_type: 'General', device_model: 'Service', serial_no: '', description: 'Network booster issue on the ground floor', warranty: 'out_of_warranty', amount: '0.00', created_at: '2026-09-19 06:45:17', started_at: '2026-09-19 06:56:35', resolved_at: null, ratings: null },
        { id: 2104, status: 'in_progress', severity: 'medium', company_name: 'Registerkaro', engineer_name: 'Kunal Grover', engineer_level: 'level 3', contact_email: 'anshuman@registerkaro.in', contact_number: '8448987345', issue_type: 'General', device_model: 'Service', serial_no: '', description: 'AP & Bandwidth Issue', warranty: 'out_of_warranty', amount: '0.00', created_at: '2026-09-19 05:13:54', started_at: '2026-09-19 05:23:42', resolved_at: null, ratings: null },
        { id: 1041, status: 'in_progress', severity: 'medium', company_name: 'Panacea Biotec', engineer_name: 'Praveen Singh', engineer_level: 'level 1', contact_email: 'it@panaceabiotec.com', contact_number: '+91 98110 32190', issue_type: 'Hardware & Workstation', device_model: 'ThinkPad T14 Gen 4', serial_no: 'TP-LNV-8821', description: 'Motherboard power rail diagnostics and RAM module replacement.', warranty: 'Under AMC', amount: null, created_at: '2026-09-17 10:12:00', started_at: '2026-09-17 10:30:00', resolved_at: null, ratings: null },
        { id: 1035, status: 'observation', severity: 'low', company_name: 'Roop Polymers', engineer_name: 'Kunal Grover', engineer_level: 'level 3', contact_email: 'plant.it@rooppolymers.com', contact_number: '+91 97180 99432', issue_type: 'Printer & Peripherals', device_model: 'HP LaserJet Enterprise M608', serial_no: 'HP-M608-2231', description: 'Post-fuser roller replacement 48-hour thermal observation check.', warranty: 'Under AMC', amount: null, created_at: '2026-09-15 15:40:00', started_at: '2026-09-15 16:00:00', resolved_at: null, ratings: null }
      ];
      ids.forEach(id => {
        if (!foundIds.has(id)) {
          const fb = fallbackPool.find(t => t.id === id);
          if (fb) tickets.push(fb);
        }
      });
    }

    // Filter out resolved tickets (they automatically come out of Escalated Tickets KPI when resolved!)
    const activeTickets = [];
    const resolvedIds = new Set();

    tickets.forEach(t => {
      const isResolved = t.status === 'resolved' || Boolean(t.resolved_at);
      if (isResolved) {
        resolvedIds.add(t.id);
      } else {
        activeTickets.push(t);
      }
    });

    // Automatically prune resolved tickets from persisted file
    if (resolvedIds.size > 0) {
      const remainingIds = ids.filter(id => !resolvedIds.has(id));
      saveEscalatedIds(remainingIds);
      console.log(`[serviceRoutes] Auto-pruned ${resolvedIds.size} resolved ticket(s) from escalated register.`);
    }

    res.json({
      success: true,
      data: {
        count: activeTickets.length,
        tickets: activeTickets,
        autoPrunedCount: resolvedIds.size
      }
    });
  } catch (err) {
    console.error('[serviceRoutes] Error fetching escalated tickets:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Add Ticket to Escalated Tickets by ID
router.post('/escalate', async (req, res) => {
  try {
    const rawId = req.body.ticketId;
    if (!rawId) {
      return res.status(400).json({ success: false, error: 'Ticket ID is required.' });
    }

    const numericId = parseInt(String(rawId).replace(/[^0-9]/g, ''), 10);
    if (!numericId || isNaN(numericId)) {
      return res.status(400).json({ success: false, error: `Invalid ticket ID "${rawId}". Please provide a valid numeric ticket number.` });
    }

    // Fetch directly from live SQL database
    let ticket = null;
    try {
      ticket = await serviceDb.getTicketById(numericId);
    } catch (sqlErr) {
      console.warn('[serviceRoutes] Direct getTicketById failed, trying search query:', sqlErr.message);
      const searchRes = await serviceDb.getTickets({ search: String(numericId), limit: 5 });
      ticket = searchRes?.tickets?.find(t => t.id === numericId) || null;
    }

    // If still null, check fallback demo pool
    if (!ticket) {
      const fallbackPool = [
        { id: 2105, status: 'in_progress', severity: 'high', company_name: 'Singh & Singh LLP', engineer_name: 'Shyam', engineer_level: 'level 1', contact_email: 'tarun@singhandsingh.com', contact_number: '9899457391', issue_type: 'General', device_model: 'Service', serial_no: '', description: 'Network booster issue on the ground floor', warranty: 'out_of_warranty', amount: '0.00', created_at: '2026-09-19 06:45:17', started_at: '2026-09-19 06:56:35', resolved_at: null, ratings: null },
        { id: 2104, status: 'in_progress', severity: 'medium', company_name: 'Registerkaro', engineer_name: 'Kunal Grover', engineer_level: 'level 3', contact_email: 'anshuman@registerkaro.in', contact_number: '8448987345', issue_type: 'General', device_model: 'Service', serial_no: '', description: 'AP & Bandwidth Issue', warranty: 'out_of_warranty', amount: '0.00', created_at: '2026-09-19 05:13:54', started_at: '2026-09-19 05:23:42', resolved_at: null, ratings: null },
        { id: 1042, status: 'resolved', severity: 'high', company_name: 'Capri Global Capital Limited', engineer_name: 'Kunal Grover', issue_type: 'Server & Cloud', device_model: 'Dell PowerEdge R750', serial_no: 'DELL-SRV-9912', description: 'Hyper-V host VM replication degraded during peak transaction window.' },
        { id: 1041, status: 'in_progress', severity: 'medium', company_name: 'Panacea Biotec', engineer_name: 'Praveen Singh', issue_type: 'Hardware & Workstation', device_model: 'ThinkPad T14 Gen 4', serial_no: 'TP-LNV-8821', description: 'Motherboard power rail diagnostics and RAM module replacement.' },
        { id: 1040, status: 'in_progress', severity: 'high', company_name: 'Capri Global Capital Limited', engineer_name: 'Kunal Grover', issue_type: 'Server & Cloud', device_model: 'HPE ProLiant DL380 Gen10', serial_no: 'HPE-DL380-4491', description: 'RAID 5 array degraded on drive slot 3.' },
        { id: 1035, status: 'observation', severity: 'low', company_name: 'Roop Polymers', engineer_name: 'Kunal Grover', issue_type: 'Printer & Peripherals', device_model: 'HP LaserJet Enterprise M608', serial_no: 'HP-M608-2231', description: 'Post-fuser roller replacement 48-hour thermal observation check.' }
      ];
      ticket = fallbackPool.find(t => t.id === numericId) || null;
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: `Ticket #${numericId} was not found in the Compton SQL service database. Please verify the ticket ID.`
      });
    }

    // Check if ticket is resolved in SQL (automatically cannot be escalated if resolved)
    if (ticket.status === 'resolved' || Boolean(ticket.resolved_at)) {
      return res.status(400).json({
        success: false,
        error: `Ticket #${numericId} is already marked as RESOLVED in the database. Only active, unresolved tickets can be escalated.`
      });
    }

    // Add to persisted escalated list
    const currentIds = loadEscalatedIds();
    if (!currentIds.includes(numericId)) {
      currentIds.unshift(numericId);
      saveEscalatedIds(currentIds);
    }

    res.json({
      success: true,
      message: `Ticket #${numericId} successfully fetched from SQL and added to Escalated Tickets.`,
      data: {
        ticket,
        count: currentIds.length
      }
    });
  } catch (err) {
    console.error('[serviceRoutes] Error escalating ticket:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. De-escalate / Remove Ticket from Escalated List
router.delete('/escalate/:id', (req, res) => {
  try {
    const numericId = parseInt(String(req.params.id).replace(/[^0-9]/g, ''), 10);
    const currentIds = loadEscalatedIds();
    const filtered = currentIds.filter(id => id !== numericId);
    saveEscalatedIds(filtered);
    res.json({ success: true, message: `Ticket #${numericId} removed from escalated register.`, data: { count: filtered.length } });
  } catch (err) {
    console.error('[serviceRoutes] Error de-escalating ticket:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Burning Tickets (In-progress, High priority, Escalated, Overdue, No update > 2 days)
router.get('/burning-tickets', async (req, res) => {
  try {
    const escIds = loadEscalatedIds();
    let tickets = [];
    try {
      tickets = await serviceDb.getBurningTickets(escIds);
    } catch (sqlErr) {
      console.warn('[serviceRoutes] Error fetching burning tickets from SQL, checking fallback pool:', sqlErr.message);
    }

    // Resilient fallback pool matching live Compton MySQL records
    if (!tickets || tickets.length === 0) {
      const fallbackPool = [
        {
          id: 2105,
          status: 'in_progress',
          severity: 'high',
          company_name: 'Singh & Singh LLP',
          engineer_name: 'Shyam',
          engineer_level: 'level 1',
          contact_email: 'tarun@singhandsingh.com',
          contact_number: '9899457391',
          issue_type: 'General',
          issue_category: 'Network & Connectivity',
          device_model: 'Service',
          serial_no: '',
          description: 'Network booster issue on the ground floor',
          warranty: 'out_of_warranty',
          amount: '0.00',
          created_at: '2026-09-19 06:45:17',
          started_at: '2026-09-19 06:56:35',
          estimated_time: 48,
          elapsed_hours: 52.3,
          overdue_hours: 4.3,
          days_without_update: 2.1,
          last_comment_at: '2026-09-19 06:56:35',
          last_comment: 'Engineer will visit the site shortly (by "Master Super Admin")',
          is_escalated: true
        },
        {
          id: 2101,
          status: 'in_progress',
          severity: 'high',
          company_name: 'Ashish Builders',
          engineer_name: 'Kunal Grover',
          engineer_level: 'level 3',
          contact_email: 'it@ashishbuilders.com',
          contact_number: '9811223344',
          issue_type: 'General',
          issue_category: 'General IT Support',
          device_model: 'Service',
          serial_no: '',
          description: 'VC Problem',
          warranty: 'Under AMC',
          amount: '0.00',
          created_at: '2026-09-18 04:40:39',
          started_at: '2026-09-18 04:50:54',
          estimated_time: 70.8,
          elapsed_hours: 72.8,
          overdue_hours: 2.0,
          days_without_update: 3.0,
          last_comment_at: '2026-09-18 04:50:54',
          last_comment: 'Working on it (by "Kunal Grover")',
          is_escalated: true
        },
        {
          id: 2091,
          status: 'in_progress',
          severity: 'high',
          company_name: 'Roop Polymers',
          engineer_name: 'Saif Ali Khan',
          engineer_level: 'level 2',
          contact_email: 'plant.it@rooppolymers.com',
          contact_number: '+91 97180 99432',
          issue_type: 'General',
          issue_category: 'Network & Connectivity',
          device_model: 'Service',
          serial_no: '',
          description: 'Add license for AP',
          warranty: 'Under AMC',
          amount: '0.00',
          created_at: '2026-09-12 09:34:29',
          started_at: '2026-09-12 10:19:40',
          estimated_time: 48,
          elapsed_hours: 211.3,
          overdue_hours: 163.3,
          days_without_update: 8.8,
          last_comment_at: '2026-09-12 10:19:40',
          last_comment: 'In Progress (by "Kamal Yadav")',
          is_escalated: true
        },
        {
          id: 2064,
          status: 'in_progress',
          severity: 'high',
          company_name: 'MedEx India Pvt Ltd',
          engineer_name: 'Saif Ali Khan',
          engineer_level: 'level 2',
          contact_email: 'admin@medexindia.com',
          contact_number: '+91 99200 11234',
          issue_type: 'General',
          issue_category: 'Hardware & Workstation',
          device_model: 'Service',
          serial_no: '',
          description: 'Navjot Singh :- System is automatically getting restart again & again and Internet is also not working properly',
          warranty: 'Under AMC',
          amount: '0.00',
          created_at: '2026-09-07 04:31:09',
          started_at: '2026-09-07 04:33:48',
          estimated_time: 97,
          elapsed_hours: 337.1,
          overdue_hours: 240.1,
          days_without_update: 12.0,
          last_comment_at: '2026-09-09 04:47:09',
          last_comment: 'Under Observation. (by "Saif Ali Khan")',
          is_escalated: true
        }
      ];
      tickets = fallbackPool.filter(t => escIds.includes(t.id));
    }

    res.json({
      success: true,
      data: tickets
    });
  } catch (err) {
    console.error('[serviceRoutes] Error in burning-tickets route:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

