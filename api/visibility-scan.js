import axios from "axios";
import * as cheerio from "cheerio";

function normalizeUrl(url) {
  if (!/^https?:\/\//i.test(url)) return "https://" + url;
  return url;
}

function buildChecks(finalUrl, $) {
  const title = $("title").first().text().trim();
  const metaDescription = $('meta[name="description"]').attr("content");
  const h1 = $("h1").first().text().trim();
  const canonical = $('link[rel="canonical"]').attr("href");
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDescription = $('meta[property="og:description"]').attr("content");

  return {
    https: finalUrl.startsWith("https://"),
    title: Boolean(title),
    metaDescription: Boolean(metaDescription),
    h1: Boolean(h1),
    canonical: Boolean(canonical),
    ogTags: Boolean(ogTitle || ogDescription)
  };
}

function buildIssues(checks) {
  const issues = [];
  if (!checks.https) issues.push("Your website is not using HTTPS.");
  if (!checks.title) issues.push("Your homepage is missing a page title.");
  if (!checks.metaDescription) issues.push("Your homepage is missing a meta description.");
  if (!checks.h1) issues.push("Your homepage is missing a clear H1 heading.");
  if (!checks.canonical) issues.push("Your homepage is missing a canonical tag.");
  if (!checks.ogTags) issues.push("Your site is missing social sharing tags.");
  return issues;
}

function scoreChecks(checks) {
  let score = 0;
  if (checks.https) score += 15;
  if (checks.title) score += 20;
  if (checks.metaDescription) score += 20;
  if (checks.h1) score += 15;
  if (checks.canonical) score += 15;
  if (checks.ogTags) score += 15;
  return score;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing URL" });
    }

    url = normalizeUrl(url);

    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 VisibilityScanner/1.0"
      }
    });

    const finalUrl = response.request?.res?.responseUrl || url;
    const $ = cheerio.load(response.data);

    const checks = buildChecks(finalUrl, $);
    const issues = buildIssues(checks);
    const score = scoreChecks(checks);

    return res.status(200).json({
      url: finalUrl,
      score,
      checks,
      issues
    });
  } catch {
    return res.status(500).json({ error: "Unable to scan this website" });
  }
}
