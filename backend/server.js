require("dotenv").config();
  const http = require("http");
  const { Server } = require("socket.io");
  const express = require("express");
  const nodemailer = require("nodemailer");
  const otpGenerator = require("otp-generator");
  const cors = require("cors");
  const mariadb = require("mariadb");
  const bcrypt = require('bcrypt');

  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const PizZip = require("pizzip");
  const Docxtemplater = require("docxtemplater");

  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET","POST"] } });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cors());
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  BigInt.prototype.toJSON = function() {
    return this.toString();
  };

  // Create storage logic
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = './uploads';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });
  const upload = multer({ storage });

  app.use('/uploads', express.static('uploads'));
  

  // MariaDB Connection
  const pool = mariadb.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "visible@2026",
    database: process.env.DB_NAME || "crm",
    dateStrings: true,
    connectionLimit: 5,
  });

  async function queryDB(sql, params) {
    let conn;
    try {
      conn = await pool.getConnection();
      const rows = await conn.query(sql, params);
      return rows;
    } catch (err) {
      throw err;
    } finally {
      if (conn) conn.release();
    }
  }

  // OTP Storage
  const otpStore = {}; 

  // Email Transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

    // SEND OTP
  app.post("/send-otp", async (req, res) => {
    try {
      let { email, type } = req.body;
      if (!type) type = 'signup'; 

      // Check if user exists
      const existingUser = await queryDB("SELECT * FROM users WHERE email = ?", [email]);
      const userExists = existingUser.length > 0;

      // Logic for Resetting Password
      if (type === 'reset') {
        if (!userExists) {
          return res.status(404).json({ 
            success: false, 
            message: "Email not found. Please register first." 
          });
        }
      } 
      // Logic for New Registration
      else if (type === 'signup') {
        if (userExists) {
          return res.status(400).json({ 
            success: false, 
            message: "Email already registered. Please login instead." 
          });
        }
      } 
      else {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid request type. Use 'signup' or 'reset'." 
        });
      }

      // OTP Generation and Sending Logic
      const otp = otpGenerator.generate(6, { 
        upperCaseAlphabets: false, 
        specialChars: false, 
        lowerCaseAlphabets: false 
      });

      await queryDB(
        `INSERT INTO otp_table (email, otp, expires_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at)`,
        [email, otp, new Date(Date.now() + 5 * 60 * 1000)]
      );

      await transporter.sendMail({
        from: `"noreply-visible" <no-reply@yourdomain.com>`,
        to: email,
        subject: "Your OTP Code",
        html: `<h2>Your OTP is: ${otp}</h2><p>Valid for 5 minutes</p>`,
      });

      res.json({ success: true, message: "OTP sent" });
    } catch (err) {
      console.error("OTP Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // VERIFY OTP
  app.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    try {
      const rows = await queryDB("SELECT * FROM otp_table WHERE email = ?", [email]);
      if (!rows || rows.length === 0) return res.json({ success: false, message: "Invalid or expired OTP" });

      const record = rows[0];
      if (new Date() > record.expires_at) {
        await queryDB("DELETE FROM otp_table WHERE email = ?", [email]);
        return res.json({ success: false, message: "OTP expired" });
      }

      if (record.otp === otp) {
        await queryDB("DELETE FROM otp_table WHERE email = ?", [email]);
        return res.json({ success: true, message: "OTP verified" });
      }

      res.json({ success: false, message: "Invalid OTP" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // REGISTER USER
  app.post("/register", async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  try {
    const existing = await queryDB("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0)
      return res.status(400).json({ success: false, message: "Email already registered" });

    // HASH THE PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    await queryDB(
      "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
      [name, email, phone, hashedPassword, role]
    );

    res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

  // LOGIN USER
  app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const users = await queryDB(
      "SELECT id, name, email, password, role, phone, about, avatar FROM users WHERE email = ?", 
      [email]
    );
    
    if (users.length === 0)
      return res.status(400).json({ success: false, message: "Invalid email or password" });

    const user = users[0];

    // COMPARE THE PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Invalid email or password" });

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        phone: user.phone,
        about: user.about,
        avatar: user.avatar
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

  // RESET PASSWORD
  app.post("/reset-password", async (req, res) => {
    try {
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log("New Hashed Password:", hashedPassword);

        await queryDB("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email]);
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        console.error("Hashing Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
  });

  // USERS
  app.get("/api/users", async (req, res) => {
    try {
      const users = await queryDB(
        "SELECT id, name, email, role, phone, about, avatar FROM users"
      );
      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error fetching users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const rows = await queryDB(
        "SELECT id, name, email, phone, role, about, avatar FROM users WHERE id=?",
        [id]
      );
      if (!rows || rows.length === 0)
        return res.status(404).json({ success: false, message: "User not found" });
      res.json({ success: true, user: rows[0] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put("/api/users/:id/profile", async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role, about, avatar } = req.body;
    if (avatar && avatar.length > 7_000_000) {
      return res.status(400).json({
        success: false,
        message: "Profile image too large. Please upload a smaller image."
      });
    }
    try {
      await queryDB(
        "UPDATE users SET name=?, email=?, phone=?, role=?, about=?, avatar=? WHERE id=?",
        [name, email, phone, role, about, avatar, id]
      );
      const updatedUser = await queryDB(
        "SELECT id, name, email, phone, role, about, avatar FROM users WHERE id=?",
        [id]
      );
      res.json({ success: true, user: updatedUser[0] });
    } catch (err) {
      console.error("Update Error:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await queryDB("DELETE FROM users WHERE id=?", [id]);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

    // API ROUTES
  app.get("/api/admin-profile", async (req, res) => {
    try {
      const users = await queryDB("SELECT name, email FROM users WHERE role = 'admin' LIMIT 1");
      if (users.length === 0) return res.json({ success: true, user: { name: "Admin", email: "admin@test.com" } });
      res.json({ success: true, user: users[0] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/api/dashboard-stats", async (req, res) => {
    try {
      const stats = await queryDB(`
        SELECT 
          COUNT(CASE WHEN status = 'Lead' THEN 1 END) as leads,
          COUNT(CASE WHEN status = 'Proposal' THEN 1 END) as proposal,
          COUNT(CASE WHEN status = 'Purchase Order' THEN 1 END) as purchaseorder,
          COUNT(CASE WHEN status = 'Site Survey-POC' THEN 1 END) as sitesurveypoc,
          COUNT(CASE WHEN status = 'Closed Lost' THEN 1 END) as closedlost,
          COUNT(CASE WHEN status = 'Completed Project' THEN 1 END) as completedproject,
          COUNT(CASE WHEN status = 'Inactive Project' THEN 1 END) as inactiveproject,
          COUNT(CASE WHEN status = 'Renewal Support' THEN 1 END) as renewalsupport,
          COUNT(CASE WHEN status = 'Previous Year Project' THEN 1 END) as previousyearproject,
          COUNT(CASE WHEN status = 'Recovered Project' THEN 1 END) as recoveredproject,
          SUM(paid_amount) as totalPaid,
          SUM(due_amount) as totalDue
        FROM projects
      `);
      const data = stats[0];
      res.json({
        success: true,
        stats: {
          leads: Number(data.leads),
          proposal: Number(data.proposal),
          purchaseorder: Number(data.purchaseorder),
          sitesurveypoc: Number(data.sitesurveypoc),
          closedlost: Number(data.closedlost),
          completedproject: Number(data.completedproject),
          inactiveproject: Number(data.inactiveproject),
          renewalsupport: Number(data.renewalsupport),
          previousyearproject: Number(data.previousyearproject),
          recoveredproject: Number(data.recoveredproject),
          totalPaid: Number(data.totalPaid || 0),
          totalDue: Number(data.totalDue || 0),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  
// PROJECTS / DEALS API
app.get("/api/projects", async (req, res) => {
  try {
    const rows = await queryDB(`
      SELECT id, deal_name, status, paid_amount, due_amount, total_amount, 
             deal_owner, description, contact, company, closed_date, created_at
      FROM projects
      ORDER BY created_at DESC
    `);
    res.json({ success: true, projects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/projects", async (req, res) => {
  const { 
    deal_name, deal_owner, status, description, 
    contact, company, total_amount, paid_amount, closed_date 
  } = req.body;

  const finalDate = (closed_date && closed_date !== "") ? closed_date : null;
  
  if (!deal_name) {
    return res.status(400).json({ success: false, message: "Deal Name is required" });
  }

  try {
    const total = parseFloat(total_amount) || 0;
    const paid = parseFloat(paid_amount) || 0;
    const due = total - paid;

    const result = await queryDB(
      `INSERT INTO projects
      (deal_name, deal_owner, status, paid_amount, due_amount, total_amount, description, contact, company, closed_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, 
      [
        deal_name, 
        deal_owner || "", 
        status || 'Lead', 
        paid, 
        due, 
        total, 
        description || "", 
        contact || "", 
        company || "",
        closed_date || null
      ]
    );

    const newId = result.insertId !== undefined ? Number(result.insertId) : result.id;
    const project = await queryDB("SELECT * FROM projects WHERE id = ?", [newId]);
    
    res.json({ success: true, project: project[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  const { id } = req.params;
  const { 
    deal_name, deal_owner, status, description, 
    contact, company, total_amount, paid_amount, closed_date 
  } = req.body;

  try {
    const total = parseFloat(total_amount) || 0;
    const paid = parseFloat(paid_amount) || 0;
    const due = total - paid;

    await queryDB(
      `UPDATE projects 
      SET deal_name=?, deal_owner=?, status=?, description=?, contact=?, 
          company=?, total_amount=?, paid_amount=?, due_amount=?, closed_date=?
      WHERE id=?`,
      [
        deal_name, 
        deal_owner || "", 
        status || 'Lead',
        description || "", 
        contact || "", 
        company || "", 
        total,
        paid,
        due,
        closed_date || null,
        id
      ]
    );
    res.json({ success: true, message: "Project updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/projects/:id/status", async (req, res) => {
  const { status, dealName, changedBy } = req.body;
  const { id } = req.params;
  try {
    await queryDB("UPDATE projects SET status=? WHERE id=?", [status, id]);

    // Always fetch deal_name from DB to guarantee it is never undefined
    const rows = await queryDB("SELECT deal_name FROM projects WHERE id=?", [id]);
    const resolvedName = rows[0]?.deal_name || dealName || "Unknown Deal";

    io.emit("deal-status-changed", {
      id: Number(id),
      status,
      dealName: resolvedName,
      changedBy: changedBy || "Admin",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Broadcast deal-created / deal-updated events to all clients
app.post("/api/projects/notify", (req, res) => {
  const { event, ...payload } = req.body;
  // Spread all payload fields so any event type works (comments, attachments, status, etc.)
  io.emit(event, {
    ...payload,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
  res.json({ success: true });
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    await queryDB("DELETE FROM projects WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "Project deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/projects/bulk", async (req, res) => {
  const { deals } = req.body;

  if (!deals || deals.length === 0) {
    return res.status(400).json({ success: false, message: "No data found" });
  }

  const allowedStatuses = [
    'Lead', 'Proposal', 'Purchase Order', 'Site Survey-POC', 
    'Closed Lost', 'Completed Project', 'Inactive Project', 
    'Renewal Support', 'Previous Year Project', 'Recovered Project'
  ];

  try {
    const values = [];
    const placeholders = deals.map((d, index) => {
      let rawStatus = d.status ? d.status.trim() : 'Lead';
      const status = allowedStatuses.includes(rawStatus) ? rawStatus : 'Lead';

      const total = parseFloat(d.total_amount) || 0;
      const paid = 0; 
      const due = total;

      values.push(
        d.deal_name || `Untitled Deal ${index + 1}`,
        d.deal_owner || "Unassigned",
        status,
        paid,
        due,
        total,
        "Excel Bulk Import",
        "",
        "",
        d.closed_date || null
      );

      return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    }).join(", ");

    const sql = `INSERT INTO projects 
      (deal_name, deal_owner, status, paid_amount, due_amount, total_amount, description, contact, company, closed_date, created_at) 
      VALUES ${placeholders}`;

    await queryDB(sql, values);

    res.json({ success: true, message: `Imported ${deals.length} deals successfully!` });
  } catch (err) {
    console.error("Critical Bulk Error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Database rejection. Check row 159 for special characters or invalid status." 
    });
  }
});

  // CLIENTS
  app.get("/api/clients", async (req, res) => {
    try {
      const rows = await queryDB("SELECT record_id, first_name, last_name, email, phone, contact_owner, assoc_company, lead_status, created_at FROM clients ORDER BY record_id ASC");
      res.json({ success: true, clients: rows });
    } catch (err) {
      console.error("Fetch Clients Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/clients", async (req, res) => {
    const { first_name, last_name, email, phone, contact_owner, assoc_company, lead_status } = req.body;
    
    try {
      const maxRes = await queryDB("SELECT COALESCE(MAX(record_id), 0) + 1 AS next_id FROM clients");
      const record_id = Number(maxRes[0].next_id);

      await queryDB(
        `INSERT INTO clients (record_id, first_name, last_name, email, phone, contact_owner, assoc_company, lead_status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [record_id, first_name, last_name, email, phone || null, contact_owner || null, assoc_company || null, lead_status || 'New']
      );
      res.json({ success: true, message: "Client added successfully" });
    } catch (err) {
      console.error("Add Client Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await queryDB("DELETE FROM clients WHERE record_id = ?", [id]);
      if (result.affectedRows > 0) {
        res.json({ success: true, message: "Client deleted" });
      } else {
        res.status(404).json({ success: false, error: "Client not found" });
      }
    } catch (err) {
      console.error("Delete Client Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

app.post('/api/clients/bulk', async (req, res) => {
    const { clients } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        const sql = `
            INSERT INTO clients (record_id, first_name, last_name, email, phone, contact_owner, assoc_company, lead_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                first_name = VALUES(first_name),
                last_name = VALUES(last_name),
                phone = VALUES(phone),
                contact_owner = VALUES(contact_owner),
                assoc_company = VALUES(assoc_company),
                lead_status = VALUES(lead_status)
        `;

        const values = clients.map(c => [
            c.record_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone || null,
            c.contact_owner || null,
            c.assoc_company || null,
            c.lead_status || 'New'
        ]);

        const result = await conn.batch(sql, values);
        res.json({ success: true, count: result.affectedRows });
    } catch (err) {
        console.error("Client Bulk Import Error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

  // TASKS API
  app.get("/api/tasks", async (req, res) => {
    try {
      const tasks = await queryDB(`
        SELECT t.*, u.name AS user_name
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
      `);
      res.json({ success: true, tasks });
    } catch (err) {
      console.error("Fetch Tasks Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/tasks", async (req, res) => {
    const { title, description, priority, deadline, user_id } = req.body;

    console.log("Adding Task for User ID:", user_id, "Priority:", priority);

    if (!user_id) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }
    if (!title) {
      return res.status(400).json({ success: false, message: "Task Title is required" });
    }

    try {
      const formattedPriority = priority 
        ? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() 
        : 'Low';

      const result = await queryDB(
        "INSERT INTO tasks (title, description, priority, deadline, user_id, status) VALUES (?, ?, ?, ?, ?, 'Pending')",
        [
          title, 
          description || "", 
          formattedPriority, 
          deadline || null, 
          user_id
        ]
      );

      const newId = result.insertId !== undefined ? Number(result.insertId) : result.id;

      if (!newId) {
          throw new Error("Failed to retrieve Insert ID from Database.");
      }

      const newTask = await queryDB("SELECT * FROM tasks WHERE id = ?", [newId]);
      res.json({ success: true, task: newTask[0] });

    } catch (err) {
      console.error("Add Task DB Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/tasks/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
      await queryDB("UPDATE tasks SET status = ? WHERE id = ?", [status, id]);
      res.json({ success: true, message: "Task status updated" });
    } catch (err) {
      console.error("DB Update Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;
    const { title, description, priority, user_id } = req.body;

    try {
      await queryDB(
        "UPDATE tasks SET title = ?, description = ?, priority = ?, user_id = ? WHERE id = ?",
        [title, description, priority, user_id, id]
      );
      res.json({ success: true, message: "Task updated successfully" });
    } catch (err) {
      console.error("Update Task Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await queryDB("DELETE FROM tasks WHERE id = ?", [id]);
      res.json({ success: true, message: "Task deleted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PROJECT COMMENTS API
    app.get("/api/projects-detailed", async (req, res) => {
      try {
        const projects = await queryDB("SELECT * FROM projects ORDER BY created_at DESC");
        
        const projectsWithDetails = await Promise.all(projects.map(async (proj) => {
          const comments = await queryDB(
            "SELECT * FROM project_comments WHERE project_id = ? ORDER BY created_at ASC", 
            [proj.id]
          );
          
          const attachments = await queryDB(
            "SELECT * FROM project_attachments WHERE project_id = ?",
            [proj.id]
          );

          return { 
            ...proj, 
            comments: comments || [], 
            attachments: attachments || [] 
          };
        }));

        res.json({ success: true, projects: projectsWithDetails });

      } catch (err) {
        console.error("Fetch Projects Error:", err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

  app.post("/api/projects/:id/comments", async (req, res) => {
    const { id } = req.params;
    const { user_name, comment_text } = req.body;
    try {
      await queryDB(
        "INSERT INTO project_comments (project_id, user_name, comment_text) VALUES (?, ?, ?)",
        [id, user_name, comment_text]
      );
      res.json({ success: true, message: "Comment added to project" });
    } catch (err) {
      console.error("Post Comment Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

    app.post('/api/projects/:id/attachments', upload.single('file'), async (req, res) => {
      const { id } = req.params;
      const { uploaded_by } = req.body;
      const { originalname, filename } = req.file;
      try {
        await queryDB(
          "INSERT INTO project_attachments (project_id, file_name, file_path, uploaded_by) VALUES (?, ?, ?, ?)",
          [id, originalname, filename, uploaded_by]
        );
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    app.delete('/api/attachments/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const rows = await queryDB("SELECT file_path FROM project_attachments WHERE id = ?", [id]);
        if (rows.length > 0) {
          const filePath = path.join(__dirname, 'uploads', rows[0].file_path);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          await queryDB("DELETE FROM project_attachments WHERE id = ?", [id]);
          res.json({ success: true });
        }
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

  // =FINANCE API
  app.get("/api/finance/projects", async (req, res) => {
    try {
      const rows = await queryDB(`
        SELECT id, deal_name, company, total_amount, paid_amount, due_amount, status 
        FROM projects 
        ORDER BY created_at DESC
      `);
      res.json({ success: true, projects: rows });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

app.put("/api/finance/update/:id", async (req, res) => {
  const { id } = req.params;
  const { paid_amount, role } = req.body;

  if (role !== 'admin' && role !== 'finance') {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }

  try {
    const project = await queryDB("SELECT total_amount, status FROM projects WHERE id = ?", [id]);
    if (project.length === 0) return res.status(404).json({ success: false, message: "Project not found" });

    const total = parseFloat(project[0].total_amount);
    const currentStatus = project[0].status;
    const paid = parseFloat(paid_amount) || 0;
    const due = total - paid;

    const sql = "UPDATE projects SET paid_amount = ?, due_amount = ?, status = ? WHERE id = ?";
    const values = [paid, due, currentStatus, id];

    await queryDB(sql, values);

    res.json({ 
      success: true, 
      balance: due.toFixed(2),
      message: "Payment updated successfully" 
    });
  } catch (err) {
    console.error("FINANCE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// FINANCE SPECIFIC DATA
app.get("/api/finance/projects", async (req, res) => {
  try {
    const rows = await queryDB("SELECT id, deal_name, company, total_amount, paid_amount, due_amount, status FROM projects ORDER BY created_at DESC");
    res.json({ success: true, projects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

 // COMPANIES API
app.get('/api/companies', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        
        const rows = await conn.query(`
            SELECT 
                CAST(record_id AS CHAR) as record_id, 
                company_name AS name, 
                company_owner AS owner, 
                industry, 
                phone, 
                city, 
                country 
            FROM company 
            ORDER BY created_at DESC
        `);

        console.log(`Successfully fetched ${rows.length} companies.`);
        res.json({ success: true, companies: rows });
    } catch (err) {
        console.error("Database Fetch Error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// POST a new company
app.post("/api/companies", async (req, res) => {
  const { name, owner, phone, city, country, industry } = req.body;
  
  try {
    await queryDB(
      `INSERT INTO company (company_name, company_owner, phone, city, country, industry) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, owner, phone, city, country, industry]
    );
    res.json({ success: true, message: "Company added successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/companies/bulk', async (req, res) => {
    const { companies } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        
        const sql = `
            INSERT INTO company (record_id, company_name, company_owner, phone, city, country, industry) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                company_name = VALUES(company_name),
                company_owner = VALUES(company_owner),
                phone = VALUES(phone),
                city = VALUES(city),
                country = VALUES(country),
                industry = VALUES(industry)
        `;

        const values = companies.map(c => [
            (c.record_id && !isNaN(c.record_id)) ? c.record_id : null, 
            c.company_name, 
            c.company_owner || null, 
            c.phone || null, 
            c.city || null, 
            c.country || null, 
            c.industry || 'Other'
        ]);

        const result = await conn.batch(sql, values);
        res.json({ success: true, count: result.affectedRows });
    } catch (err) {
        console.error("Bulk Import Error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

app.post('/api/clients/bulk', async (req, res) => {
  console.log("Received data:", req.body.clients);
    const { clients } = req.body;
    let conn;
    try {
        conn = await pool.getConnection();
        const sql = `
            INSERT INTO clients (record_id, first_name, last_name, email, phone, contact_owner, assoc_company, lead_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                first_name = VALUES(first_name),
                last_name = VALUES(last_name),
                phone = VALUES(phone),
                contact_owner = VALUES(contact_owner),
                assoc_company = VALUES(assoc_company),
                lead_status = VALUES(lead_status)
        `;

        const values = clients.map(c => [
            c.record_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone || null,
            c.contact_owner || null,
            c.assoc_company || null,
            c.lead_status || 'New'
        ]);

        const result = await conn.batch(sql, values);
        res.json({ success: true, count: result.affectedRows });
    } catch (err) {
        console.error("Client Bulk Import Error:", err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// TIMETREE EVENTS API
app.get("/api/timetree/users", async (req, res) => {
    try {
        const users = await queryDB("SELECT id, name, email FROM users");
        return res.json({ success: true, users });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/timetree/events", async (req, res) => {
    try {
        await queryDB(`
            UPDATE timetree_events 
            SET status = 'completed' 
            WHERE status = 'pending' 
            AND deadline_date IS NOT NULL 
            AND (
                deadline_date < CURDATE() 
                OR (deadline_date = CURDATE() AND deadline_time < CURTIME())
            )
        `);
        const events = await queryDB("SELECT id, title, event_date, start_time, deadline_date, deadline_time, status FROM timetree_events ORDER BY event_date ASC, start_time ASC");

        for (let event of events) {
            const chats = await queryDB("SELECT * FROM event_chats WHERE event_id = ?", [event.id]);
            event.chats = chats;
        }

        return res.json({ success: true, events });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/api/timetree/events", async (req, res) => {
    try {
        const { title, date, startTime, deadline_date, deadlineTime } = req.body;

        if (!title || !date) {
            return res.status(400).json({ success: false, error: "Title and Date are required." });
        }

        const finalStartTime = (startTime && startTime.length === 5) ? `${startTime}:00` : startTime;
        const finalDeadlineTime = (deadlineTime && deadlineTime.length === 5) ? `${deadlineTime}:00` : deadlineTime;
        const finalDate = date.split('T')[0]; 
        const finalDeadlineDate = (deadline_date && deadline_date.trim() !== "") ? deadline_date : null;

        const result = await queryDB(
            "INSERT INTO timetree_events (title, event_date, start_time, deadline_date, deadline_time, status) VALUES (?, ?, ?, ?, ?, ?)",
            [title, finalDate, finalStartTime, finalDeadlineDate, finalDeadlineTime || null, 'pending']
        );

        return res.json({ 
            success: true, 
            insertId: result.insertId.toString() 
        });

    } catch (err) {
        console.error("MARIADB ERROR:", err.sqlMessage || err.message);
        return res.status(500).json({ success: false, error: err.sqlMessage || err.message });
    }
});

app.post("/api/timetree/events/:id/chat", async (req, res) => {
    const { id } = req.params;
    const { sender_id, sender_name, sender_email, message_text } = req.body; 

    try {
        await queryDB(
            "INSERT INTO event_chats (event_id, sender_id, sender_name, sender_email, message_text) VALUES (?, ?, ?, ?, ?)",
            [id, sender_id, sender_name, sender_email, message_text]
        );
        res.json({ success: true, message: "Chat saved" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Database error" });
    }
});

app.put("/api/timetree/events/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await queryDB("UPDATE timetree_events SET status = ? WHERE id = ?", [status, id]);
        res.json({ success: true, message: "Status updated" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete("/api/timetree/events/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await queryDB("DELETE FROM event_chats WHERE event_id = ?", [id]); 
        await queryDB("DELETE FROM timetree_events WHERE id = ?", [id]);
        res.json({ success: true, message: "Event deleted" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete("/api/timetree/chat/:chatId", async (req, res) => {
    const { chatId } = req.params;
    try {
        await queryDB("DELETE FROM event_chats WHERE id = ?", [chatId]);
        res.json({ success: true, message: "Message deleted" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put("/api/timetree/chat/:chatId", async (req, res) => {
    const { chatId } = req.params;
    const { message_text } = req.body;
    try {
        await queryDB("UPDATE event_chats SET message_text = ? WHERE id = ?", [message_text, chatId]);
        res.json({ success: true, message: "Message updated" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/generate-document", (req, res) => {

  const templatePath = path.join(__dirname, "templates", "Sample_Template.docx");

  const content = fs.readFileSync(templatePath, "binary");

  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip);

  doc.setData({
    prefix: req.body.prefix,
    client_name: req.body.client_name,
    company_name: req.body.company_name,
    salesrep_name: req.body.salesrep_name,
    contact_number: req.body.contact_number,
    position: req.body.position,
    project_name: req.body.project_name,
    date: req.body.date
  });

  try {

    doc.render();

    const buf = doc.getZip().generate({
      type: "nodebuffer"
    });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Generated_Proposal.docx"
    );

    res.send(buf);

  } catch (error) {

    console.error(error);
    res.status(500).send("Error generating document");

  }

});

// ================================================================
// BOM MODULE ROUTES
// ================================================================

function getBomCategoryKey(productCategory) {
  if (!productCategory) return 'OTHER';
  const c = productCategory.toLowerCase();
  if (c.includes('router'))                               return 'ROUTER';
  if (c.includes('wireless') || c.includes('/ ap'))      return 'ACCESS_POINT';
  if (c.includes('access controller'))                    return 'ACCESS_POINT';
  if (c.includes('firewall') || c.includes('security'))  return 'FIREWALL';
  if (c.includes('software'))                             return 'SOFTWARE';
  if (c.includes('accessory'))                            return 'ACCESSORY';
  if (c.includes('access point') || c.includes('ap'))    return 'ACCESS_POINT';
  if (c.includes('gateway'))                              return 'ROUTER';
  if (c.includes('management'))                           return 'SOFTWARE';
  if (c.includes('x-link'))                               return 'OTHER';
  if (c.includes('switch'))                               return 'SWITCHES';
  return 'OTHER';
}

// PRODUCTS
app.get('/api/bom/products', async (req, res) => {
  const { vendor = 'ruijie', category, subcategory, search } = req.query;
  try {
    let sql = 'SELECT * FROM bom_products WHERE vendor = ?';
    const params = [vendor];

    if (category && category !== 'ALL') {
      const catMap = {
        ROUTER:       ['Router'],
        SWITCHES:     ['Switch'],
        ACCESS_POINT: ['Wireless / AP', 'Access Controller'],
        FIREWALL:     ['Firewall / Security'],
        SOFTWARE:     ['Software'],
        ACCESSORY:    ['Switch Accessory'],
      };
      const mapped = catMap[category];
      if (mapped) {
        sql += ` AND product_category IN (${mapped.map(() => '?').join(',')})`;
        params.push(...mapped);
      }
    }

    if (subcategory && subcategory !== 'ALL') {
      sql += ' AND sub_category = ?';
      params.push(subcategory);
    }

    if (search && search.trim()) {
      sql += ' AND (model LIKE ? OR sub_category LIKE ? OR notes LIKE ?)';
      const like = `%${search.trim()}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY product_category, sub_category, model';
    const rows = await queryDB(sql, params);
    const products = rows.map(p => ({
      ...p,
      tag_dc:         Number(p.tag_dc),
      tag_enterprise: Number(p.tag_enterprise),
      tag_sme:        Number(p.tag_sme),
      market_price:   p.market_price ? Number(p.market_price) : 0,
      categoryKey:    getBomCategoryKey(p.product_category),
    }));
    res.json({ success: true, products });
  } catch (err) {
    console.error('GET /api/bom/products error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bom/products/categories', async (req, res) => {
  const { vendor = 'ruijie' } = req.query;
  try {
    const rows = await queryDB(
      `SELECT DISTINCT product_category, sub_category FROM bom_products WHERE vendor = ? ORDER BY product_category, sub_category`,
      [vendor]
    );
    const tree = {};
    for (const row of rows) {
      const key = getBomCategoryKey(row.product_category);
      if (!tree[key]) tree[key] = { label: row.product_category, subcategories: [] };
      if (row.sub_category && !tree[key].subcategories.includes(row.sub_category)) {
        tree[key].subcategories.push(row.sub_category);
      }
    }
    res.json({ success: true, categories: tree });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bom/products/import', async (req, res) => {
  const { products, vendor } = req.body;
  if (!products || !products.length) {
    return res.status(400).json({ success: false, error: 'No products provided.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const sql = `
      INSERT INTO bom_products
        (model, vendor, segment, product_category, sub_category, wireless_standard, deployment, management_type, poe, tag_dc, tag_enterprise, tag_sme, notes, market_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        segment          = VALUES(segment),
        product_category = VALUES(product_category),
        sub_category     = VALUES(sub_category),
        wireless_standard = VALUES(wireless_standard),
        deployment       = VALUES(deployment),
        management_type  = VALUES(management_type),
        poe              = VALUES(poe),
        tag_dc           = VALUES(tag_dc),
        tag_enterprise   = VALUES(tag_enterprise),
        tag_sme          = VALUES(tag_sme),
        notes            = VALUES(notes),
        market_price     = VALUES(market_price)
    `;
    const values = products.map(p => [
      p.model,
      vendor || p.vendor || 'ruijie',
      p.segment || '',
      p.product_category || '',
      p.sub_category || '',
      (p.wireless_standard || '').substring(0, 191),
      p.deployment || '',
      p.management_type || '',
      p.poe || '',
      p.tag_dc ? 1 : 0,
      p.tag_enterprise ? 1 : 0,
      p.tag_sme ? 1 : 0,
      p.notes || '',
      parseFloat(p.market_price) || 0,
    ]);
    const result = await conn.batch(sql, values);
    res.json({ success: true, count: result.affectedRows });
  } catch (err) {
    console.error('BOM Import error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Update market price for a single product (admin only)
app.put('/api/bom/products/:id/market-price', async (req, res) => {
  const { market_price } = req.body;
  try {
    await queryDB(
      'UPDATE bom_products SET market_price = ? WHERE id = ?',
      [parseFloat(market_price) || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('BOM market price update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/bom/products/:id', async (req, res) => {
  try {
    await queryDB('DELETE FROM bom_products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DRAFTS

// ── BOM real-time broadcast endpoint ─────────────────────────────────────────
// targetRoles: null/undefined = everyone, array = only those roles
app.post('/api/bom/notify', (req, res) => {
  const { event, draftName, changedBy, reason, targetRoles } = req.body;
  io.emit(event, {
    draftName: draftName || 'Unknown BOM',
    changedBy: changedBy || 'Someone',
    reason: reason || '',
    targetRoles: targetRoles || null,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });
  res.json({ success: true });
});

app.get('/api/bom/drafts', async (req, res) => {
  try {
    const drafts = await queryDB(`
      SELECT d.*, COUNT(di.id) AS item_count, u.name AS created_by_name
      FROM bom_drafts d
      LEFT JOIN bom_draft_items di ON di.draft_id = d.id
      LEFT JOIN users u ON u.id = d.created_by
      GROUP BY d.id
      ORDER BY d.saved_at DESC
    `);
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/bom/drafts/:id', async (req, res) => {
  try {
    const [draft] = await queryDB('SELECT * FROM bom_drafts WHERE id = ?', [req.params.id]);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });

    const items = await queryDB(`
      SELECT di.id, di.draft_id, di.qty, di.note, di.unit_price,
        COALESCE(bp.model, di.model) AS model,
        COALESCE(bp.vendor, di.vendor) AS vendor,
        bp.segment, bp.product_category, bp.sub_category, bp.poe, bp.wireless_standard,
        COALESCE(bp.market_price, 0) AS market_price
      FROM bom_draft_items di
      LEFT JOIN bom_products bp ON bp.id = di.product_id
      WHERE di.draft_id = ?
    `, [req.params.id]);

    // Cast numeric fields
    const mapped = items.map(it => ({
      ...it,
      unit_price:   it.unit_price   ? Number(it.unit_price)   : null,
      market_price: it.market_price ? Number(it.market_price) : 0,
    }));

    res.json({ success: true, draft, items: mapped });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bom/drafts', async (req, res) => {
  const { id, name, vendor, items, status, created_by } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    let draftId = id;

    if (id) {
      await conn.query(
        'UPDATE bom_drafts SET name = ?, vendor = ?, status = ?, saved_at = NOW() WHERE id = ?',
        [name, vendor || 'ruijie', status || 'draft', id]
      );
      await conn.query('DELETE FROM bom_draft_items WHERE draft_id = ?', [id]);
    } else {
      const result = await conn.query(
        'INSERT INTO bom_drafts (name, vendor, status, created_by, saved_at) VALUES (?, ?, ?, ?, NOW())',
        [name, vendor || 'ruijie', status || 'draft', created_by || null]
      );
      draftId = result.insertId.toString();
    }

    if (items && items.length > 0) {
      const itemSql = 'INSERT INTO bom_draft_items (draft_id, product_id, model, vendor, qty, note, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const itemValues = items.map(i => [
        draftId, i.product_id || null, i.model,
        i.vendor || vendor, i.qty || 1, i.note || '', i.unit_price || null
      ]);
      await conn.batch(itemSql, itemValues);
    }

    res.json({ success: true, id: draftId });
  } catch (err) {
    console.error('BOM Draft save error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

app.put('/api/bom/drafts/:id/notes', async (req, res) => {
  const { notes } = req.body;
  try {
    await queryDB('UPDATE bom_drafts SET notes = ? WHERE id = ?', [notes || '', req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/bom/drafts/:id/forward', async (req, res) => {
  try {
    await queryDB(
      'UPDATE bom_drafts SET status = ?, forwarded_at = NOW() WHERE id = ?',
      ['pricing', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/bom/drafts/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'pricing', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status.' });
  }
  try {
    await queryDB('UPDATE bom_drafts SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/bom/drafts/:id', async (req, res) => {
  try {
    await queryDB('DELETE FROM bom_draft_items WHERE draft_id = ?', [req.params.id]);
    await queryDB('DELETE FROM bom_drafts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save pricing (unit_price per item)
app.put('/api/bom/drafts/:id/pricing', async (req, res) => {
  const { items } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    for (const item of items) {
      await conn.query(
        'UPDATE bom_draft_items SET unit_price = ?, note = ? WHERE id = ?',
        [item.unit_price || 0, item.note || '', item.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('BOM Pricing save error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// Admin: Approve → generate PO docx
app.post('/api/bom/drafts/:id/approve', async (req, res) => {
  const { userRole, company_name, company_address, contact_person, designation, salesrep_name, contact_number, email } = req.body;
  if (userRole !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });

  try {
    const [draft] = await queryDB('SELECT * FROM bom_drafts WHERE id = ?', [req.params.id]);
    if (!draft) return res.status(404).json({ success: false, error: 'Draft not found' });

    const dbItems = await queryDB(`
      SELECT di.id, di.draft_id, di.product_id, di.qty, di.unit_price, di.note,
             COALESCE(bp.model, di.model) AS model, bp.product_category,
             COALESCE(bp.market_price, 0) AS market_price
      FROM bom_draft_items di
      LEFT JOIN bom_products bp ON bp.id = di.product_id
      WHERE di.draft_id = ?
    `, [req.params.id]);

    const gross = dbItems.reduce((sum, it) => sum + ((it.unit_price || 0) * it.qty), 0);
    const poNumber = `PO-${Date.now()}`;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const templatePath = path.join(__dirname, 'templates', 'PO_Template.docx');
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter(part) {
        if (!part.module) return '';
        if (part.module === 'rawxml') return '';
        return '';
      },
    });

    doc.setData({
      date:            today,
      company_name:    company_name    || '',
      company_address: company_address || '',
      contact_person:  contact_person  || '',
      designation:     designation     || '',
      contact_number:  contact_number  || '',
      salesrep_name:   salesrep_name   || '',
      email:           email           || '',
      gross:           gross.toLocaleString('en-PH', { minimumFractionDigits: 2 }),

      items: dbItems.map((item, idx) => {
        const unitPrice = item.unit_price || 0;
        const amount    = unitPrice * item.qty;
        return {
          item_no:          String(idx + 1),
          product_model:    item.model || '',
          product_category: item.product_category || '',
          unit:             'pcs',
          quantity:         String(item.qty),
          price:            unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
          amount:           amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        };
      }),
    });

    doc.render();

    const outputDir = path.join(__dirname, 'po_files');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const fileName = `PO_${poNumber}.docx`;
    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    fs.writeFileSync(path.join(outputDir, fileName), buf);

    await queryDB(
      'UPDATE bom_drafts SET status = ?, po_number = ?, po_file = ?, approved_at = NOW() WHERE id = ?',
      ['approved', poNumber, fileName, req.params.id]
    );

    res.json({ success: true, poNumber, fileName });
  } catch (err) {
    if (err.properties && Array.isArray(err.properties.errors)) {
      console.error('BOM Approve MultiError — broken tags in PO_Template.docx:');
      err.properties.errors.forEach((e, i) => {
        console.error(`  [${i + 1}]`, e.message, '→', JSON.stringify(e.properties));
      });
    } else {
      console.error('BOM Approve error:', err);
    }
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.properties?.errors?.map(e => e.message) || [],
    });
  }
});

// Admin: Reject → back to draft with reason
app.post('/api/bom/drafts/:id/reject', async (req, res) => {
  const { userRole, reject_reason } = req.body;
  if (userRole !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  try {
    await queryDB(
      'UPDATE bom_drafts SET status = ?, reject_reason = ?, rejected_at = NOW() WHERE id = ?',
      ['rejected', reject_reason || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download PO file
app.get('/api/bom/drafts/:id/po-download', async (req, res) => {
  try {
    const [draft] = await queryDB('SELECT po_file, po_number FROM bom_drafts WHERE id = ?', [req.params.id]);
    if (!draft || !draft.po_file) return res.status(404).json({ error: 'PO file not found' });
    const filePath = path.join(__dirname, 'po_files', draft.po_file);
    res.download(filePath, draft.po_file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // SERVER
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
