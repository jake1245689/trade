import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.SUPABASE_URL.replace("https", "postgres") + "/postgres",
  ssl: { rejectUnauthorized: false }
});

app.get("/api/jobs/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT id, job_name, start_date, status FROM jobs WHERE user_id = $1 ORDER BY start_date",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/complete-job", async (req, res) => {
  try {
    const { jobId, actualCompletionDate } = req.body;

    const completedJob = await pool.query("SELECT * FROM jobs WHERE id = $1", [jobId]);
    if (!completedJob.rows.length) return res.status(404).json({ error: "Job not found" });

    const userId = completedJob.rows[0].user_id;
    const originalDate = completedJob.rows[0].start_date;

    await pool.query("UPDATE jobs SET status = 'complete', actual_completion_date = $1 WHERE id = $2",
      [actualCompletionDate, jobId]);

    const futureJobs = await pool.query(
      "SELECT * FROM jobs WHERE user_id = $1 AND start_date > $2 ORDER BY start_date",
      [userId, originalDate]
    );

    let currentDate = new Date(actualCompletionDate);
    for (const job of futureJobs.rows) {
      currentDate.setDate(currentDate.getDate() + 1);
      await pool.query("UPDATE jobs SET start_date = $1 WHERE id = $2", [
        currentDate.toISOString().split("T")[0],
        job.id
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
