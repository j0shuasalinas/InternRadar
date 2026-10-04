export type EmailOpportunity = {
  company: string;
  title: string;
  location: string;
  workMode: string;
  deadline: string;
  detailUrl: string;
  sourceUrl: string;
  eligibility: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function page(title: string, body: string, unsubscribeUrl: string): { html: string; text: string } {
  const safeTitle = escapeHtml(title);
  const safeUnsubscribe = escapeHtml(unsubscribeUrl);
  return {
    html: `<!doctype html><html><body style="margin:0;background:#f4f6f5;color:#182b3c;font-family:Arial,sans-serif"><main style="max-width:620px;margin:24px auto;padding:32px;background:#fff;border:1px solid #dce2e3;border-radius:8px"><p style="margin:0 0 12px;color:#315fc7;font-size:12px;font-weight:700">INTERNRADAR</p><h1 style="margin:0 0 18px;font-size:24px">${safeTitle}</h1>${body}<hr style="margin:26px 0;border:0;border-top:1px solid #dce2e3"><p style="font-size:12px;color:#697782">Always confirm eligibility and deadlines with the original listing. <a href="${safeUnsubscribe}" style="color:#315fc7">Unsubscribe from email alerts</a></p></main></body></html>`,
    text: `${title}\n\n${stripHtml(body)}\n\nConfirm eligibility and deadlines with each original listing. Unsubscribe: ${unsubscribeUrl}`,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>|<\/h[1-6]>|<\/li>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function renderWeeklyDigest(opportunities: EmailOpportunity[], unsubscribeUrl: string): { html: string; text: string } {
  const rows = opportunities.map((opportunity) => `<li style="margin:0 0 16px;padding:0 0 14px;border-bottom:1px solid #edf0ef"><strong>${escapeHtml(opportunity.title)}</strong><br><span style="color:#65747d">${escapeHtml(opportunity.company)} · ${escapeHtml(opportunity.location)} · ${escapeHtml(opportunity.workMode)}</span><br><span style="color:#697782">${escapeHtml(opportunity.eligibility)} · Deadline: ${escapeHtml(opportunity.deadline)}</span><br><a href="${escapeHtml(opportunity.detailUrl)}" style="color:#315fc7">View details on InternRadar</a> · <a href="${escapeHtml(opportunity.sourceUrl)}" style="color:#315fc7">Original listing</a></li>`).join("");
  return page("A few new roles for your radar", `<p style="color:#52626d">These curated opportunities match your saved preferences and are not already in your tracker.</p><ul style="padding-left:20px">${rows}</ul>`, unsubscribeUrl);
}

export function renderDeadlineReminder(opportunity: EmailOpportunity, unsubscribeUrl: string): { html: string; text: string } {
  const content = `<p style="color:#52626d">A role in your tracker has an upcoming deadline.</p><p><strong>${escapeHtml(opportunity.title)}</strong><br>${escapeHtml(opportunity.company)} · ${escapeHtml(opportunity.location)}</p><p>Deadline: <strong>${escapeHtml(opportunity.deadline)}</strong></p><p>Eligibility: ${escapeHtml(opportunity.eligibility)}</p><p><a href="${escapeHtml(opportunity.detailUrl)}" style="color:#315fc7">View opportunity details</a> · <a href="${escapeHtml(opportunity.sourceUrl)}" style="color:#315fc7">Confirm the deadline on the original listing</a></p>`;
  return page("A deadline is coming up", content, unsubscribeUrl);
}