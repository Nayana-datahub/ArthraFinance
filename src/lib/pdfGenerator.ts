"use client";

/**
 * Date formatting helper for PDF reports
 * Strict format: D/M/YYYY (numeric values only)
 */
function formatDateDMY(input: string | Date | null | undefined): string {
  if (!input) return "—";

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return "—";
    return `${input.getDate()}/${input.getMonth() + 1}/${input.getFullYear()}`;
  }

  const str = String(input).trim();
  if (!str) return "—";

  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return `${day}/${month}/${year}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getDate()}/${parsed.getMonth() + 1}/${parsed.getFullYear()}`;
  }

  return str;
}

/**
 * ArthraFinance - Pure Client-Side PDF Generation Utility
 *
 * For BCA Viva Presentation:
 * -------------------------------------------------------------
 * 1. Why Pure Client-Side?
 *    Instead of relying on browser print dialogs (window.print()) which show
 *    heavy system dialogs with margins and paper sizes, or heavy external npm packages
 *    (which increase bundle size and require complex canvas engines), this module generates
 *    a standard, 100% compliant PDF 1.4 document directly in memory using standard PDF operators.
 *
 * 2. How Standard PDF Works:
 *    - PDF is an ASCII/binary document format containing objects (Catalog, Pages, Page, Fonts, Streams).
 *    - Type 1 Standard Fonts: /Helvetica and /Helvetica-Bold are built into all PDF viewers (Adobe, Chrome, Edge).
 *    - Graphics Operators:
 *      * 'rg' / 'RG': Sets fill / stroke colors (RGB between 0.0 and 1.0)
 *      * 're f': Defines and fills rectangles (used for cards, bars, charts)
 *      * 'm l S': Moves to point, draws line to point, and strokes (used for dividers)
 *      * 'BT /Font Size Tf x y Td (text) Tj ET': Begins text, sets font, positions, prints text, and ends text block.
 *
 * 3. Direct Download:
 *    - The generated binary PDF string is converted to a Uint8Array Blob of type 'application/pdf'.
 *    - An invisible anchor link (<a download="...">) is clicked programmatically to trigger
 *      the direct file download to the user's device without ever opening the browser print dialog.
 */

export interface ReportCategoryItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface ReportTransactionItem {
  id?: string;
  name: string;
  amount: number;
  type: "Income" | "Expense";
  category: string;
  account: string;
  date: string;
}

export interface ReportPdfData {
  userName: string;
  reportTitle?: string;
  dateRangeLabel?: string;
  generatedDate: string;
  totalIncome: number;
  totalExpenses: number;
  totalBalance: number;
  netBalance?: number;
  totalTransactionCount?: number;
  budget?: {
    isSet: boolean;
    overallBudget: number;
    totalSpent: number;
    remainingBudget: number;
    exceededAmount: number;
    isExceeded: boolean;
    percentUsed: number;
  };
  categoryBreakdown: ReportCategoryItem[];
  transactions: ReportTransactionItem[];
}

/**
 * Escapes special characters for PDF text strings.
 * In PDF syntax, parentheses '(' and ')' and backslashes '\' must be escaped.
 */
function escapePdfText(text: string | number): string {
  if (text === null || text === undefined) return "";
  return text
    .toString()
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Formats a number to Indian currency format without the unicode symbol
 * (Standard Helvetica uses 'Rs.' for universally crisp display across all viewers).
 */
function formatCurrency(amount: number): string {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;
}

/**
 * Generates the raw binary string for a PDF 1.4 document containing the financial report.
 */
export function buildFinancialReportPdfString(data: ReportPdfData): string {
  const {
    userName = "Nayana",
    generatedDate = "November 3, 2026",
    totalIncome = 0,
    totalExpenses = 0,
    totalBalance = 0,
    totalTransactionCount,
    budget,
    categoryBreakdown = [],
    transactions = [],
  } = data;

  const pages: string[] = [];

  // Helper functions for PDF drawing operators
  const setFont = (font: string, size: number) => `/${font} ${size} Tf\n`;
  const setFillColor = (r: number, g: number, b: number) =>
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`;
  const setStrokeColor = (r: number, g: number, b: number) =>
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n`;
  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill = true,
    stroke = false
  ) => {
    let cmd = `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re `;
    if (fill && stroke) cmd += "B\n";
    else if (fill) cmd += "f\n";
    else if (stroke) cmd += "S\n";
    return cmd;
  };
  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width = 1
  ) => {
    return `${width.toFixed(1)} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S\n`;
  };
  const drawText = (
    text: string | number,
    x: number,
    y: number,
    font = "F1",
    size = 10,
    r = 0.1,
    g = 0.1,
    b = 0.1
  ) => {
    return `BT\n${setFont(font, size)}${setFillColor(r, g, b)}${x.toFixed(1)} ${y.toFixed(1)} Td\n(${escapePdfText(text)}) Tj\nET\n`;
  };

  // =========================================================================
  // PAGE 1: Header, Executive Summary Cards, Visual Chart, & Category Breakdown
  // =========================================================================
  let p1 = "";

  // 1. Top Decorative Brand Bar
  p1 += setFillColor(0.12, 0.28, 0.75); // Deep Indigo/Blue
  p1 += drawRect(0, 834, 595, 8, true, false);

  // 2. Brand Logo Box ("AF") & Application Title
  p1 += setFillColor(0.15, 0.35, 0.85);
  p1 += drawRect(40, 770, 36, 36, true, false);
  p1 += drawText("AF", 48, 782, "F2", 16, 1, 1, 1);

  p1 += drawText("ArthraFinance", 86, 792, "F2", 18, 0.08, 0.12, 0.25);
  p1 += drawText(
    "Financial Performance & Statement Report",
    86,
    775,
    "F1",
    10,
    0.4,
    0.45,
    0.55
  );

  // 3. Document Metadata (Right aligned: Account Owner & Generated Date)
  const displayGeneratedDate = formatDateDMY(generatedDate || new Date());
  p1 += drawText(`Account Owner: ${userName}`, 380, 788, "F2", 9, 0.2, 0.25, 0.35);
  p1 += drawText(`Generated: ${displayGeneratedDate}`, 380, 774, "F1", 9, 0.4, 0.45, 0.55);

  // 4. Header Divider Line
  p1 += setStrokeColor(0.85, 0.88, 0.93);
  p1 += drawLine(40, 755, 555, 755, 1);

  // 5. Summary Metric Cards (Total Income, Total Expenses, Total Balance)
  // Card A: Total Income (Emerald accent)
  p1 += setFillColor(0.96, 0.99, 0.97);
  p1 += setStrokeColor(0.8, 0.93, 0.85);
  p1 += drawRect(40, 668, 165, 68, true, true);
  p1 += setFillColor(0.02, 0.59, 0.41);
  p1 += drawRect(40, 732, 165, 4, true, false);
  p1 += drawText("TOTAL INCOME", 52, 715, "F2", 9, 0.35, 0.45, 0.4);
  p1 += drawText(formatCurrency(totalIncome), 52, 692, "F2", 14, 0.02, 0.59, 0.41);
  p1 += drawText("Income across all accounts", 52, 677, "F1", 8, 0.4, 0.5, 0.45);

  // Card B: Total Expenses (Rose accent)
  p1 += setFillColor(0.99, 0.96, 0.96);
  p1 += setStrokeColor(0.97, 0.82, 0.82);
  p1 += drawRect(215, 668, 165, 68, true, true);
  p1 += setFillColor(0.88, 0.11, 0.28);
  p1 += drawRect(215, 732, 165, 4, true, false);
  p1 += drawText("TOTAL EXPENSES", 227, 715, "F2", 9, 0.55, 0.35, 0.35);
  p1 += drawText(formatCurrency(totalExpenses), 227, 692, "F2", 14, 0.88, 0.11, 0.28);
  p1 += drawText("Outgoing expenses across accounts", 227, 677, "F1", 8, 0.55, 0.4, 0.4);

  // Card C: Total Balance (Opening Balances + Total Income - Total Expenses)
  const isPositiveBalance = totalBalance >= 0;
  p1 += setFillColor(0.96, 0.97, 1.0);
  p1 += setStrokeColor(0.82, 0.85, 0.98);
  p1 += drawRect(390, 668, 165, 68, true, true);
  p1 += setFillColor(0.15, 0.35, 0.85); // Blue accent
  p1 += drawRect(390, 732, 165, 4, true, false);
  p1 += drawText("TOTAL BALANCE", 402, 715, "F2", 9, 0.2, 0.25, 0.45);
  p1 += drawText(
    `${totalBalance < 0 ? "-" : ""}${formatCurrency(Math.abs(totalBalance))}`,
    402,
    692,
    "F2",
    14,
    isPositiveBalance ? 0.15 : 0.85,
    isPositiveBalance ? 0.35 : 0.2,
    isPositiveBalance ? 0.85 : 0.2
  );
  p1 += drawText(
    "Combined balance across accounts",
    402,
    677,
    "F1",
    8,
    0.4,
    0.4,
    0.55
  );

  // 6. Visual Section A: Income vs Expenses Comparative Bar Chart
  p1 += setFillColor(1, 1, 1);
  p1 += setStrokeColor(0.88, 0.91, 0.94);
  p1 += drawRect(40, 480, 250, 175, true, true);
  p1 += drawText("Income vs Expenses", 52, 638, "F2", 11, 0.1, 0.15, 0.25);
  p1 += drawText("Visual comparative cash flow", 52, 627, "F1", 7.5, 0.5, 0.55, 0.6);

  const maxVal = Math.max(totalIncome, totalExpenses, 1);
  const incH = Math.max(8, Math.round((totalIncome / maxVal) * 75));
  const expH = Math.max(8, Math.round((totalExpenses / maxVal) * 75));

  // Chart baseline
  p1 += setStrokeColor(0.88, 0.91, 0.94);
  p1 += drawLine(65, 532, 265, 532, 1);

  // Income visual bar
  p1 += setFillColor(0.02, 0.59, 0.41);
  p1 += drawRect(95, 532, 42, incH, true, false);
  p1 += drawText(
    formatCurrency(totalIncome),
    78,
    536 + incH,
    "F2",
    7.5,
    0.02,
    0.59,
    0.41
  );
  p1 += drawText("Income", 102, 520, "F2", 8.5, 0.2, 0.25, 0.3);

  // Expense visual bar
  p1 += setFillColor(0.88, 0.11, 0.28);
  p1 += drawRect(185, 532, 42, expH, true, false);
  p1 += drawText(
    formatCurrency(totalExpenses),
    168,
    536 + expH,
    "F2",
    7.5,
    0.88,
    0.11,
    0.28
  );
  p1 += drawText("Expenses", 188, 520, "F2", 8.5, 0.2, 0.25, 0.3);

  // Summary metrics below the chart (Total Income, Total Expenses)
  p1 += setFillColor(0.96, 0.97, 0.99);
  p1 += drawRect(52, 492, 105, 22, true, false);
  p1 += drawText("Income:", 58, 503, "F1", 6.5, 0.4, 0.45, 0.55);
  p1 += drawText(formatCurrency(totalIncome), 58, 495, "F2", 7, 0.02, 0.59, 0.41);

  p1 += setFillColor(0.96, 0.97, 0.99);
  p1 += drawRect(165, 492, 105, 22, true, false);
  p1 += drawText("Expenses:", 171, 503, "F1", 6.5, 0.4, 0.45, 0.55);
  p1 += drawText(formatCurrency(totalExpenses), 171, 495, "F2", 7, 0.88, 0.11, 0.28);

  // 7. Visual Section B: Expense Breakdown by Category
  p1 += setFillColor(1, 1, 1);
  p1 += setStrokeColor(0.88, 0.91, 0.94);
  p1 += drawRect(305, 480, 250, 175, true, true);
  p1 += drawText("Expense Breakdown by Category", 317, 638, "F2", 10, 0.1, 0.15, 0.25);
  p1 += drawText("Categorized spending distribution", 317, 627, "F1", 7.5, 0.5, 0.55, 0.6);

  if (categoryBreakdown.length === 0) {
    p1 += drawText(
      "No expenses recorded for this period.",
      335,
      560,
      "F1",
      8.5,
      0.5,
      0.55,
      0.6
    );
  } else {
    let catY = 604;
    const catColors: [number, number, number][] = [
      [0.15, 0.35, 0.85], // blue
      [0.02, 0.59, 0.41], // green
      [0.55, 0.25, 0.85], // purple
      [0.92, 0.55, 0.05], // amber
      [0.88, 0.11, 0.28], // rose
      [0.05, 0.65, 0.75], // cyan
    ];

    categoryBreakdown.slice(0, 5).forEach((cat, idx) => {
      const color = catColors[idx % catColors.length];
      p1 += setFillColor(...color);
      p1 += drawRect(317, catY + 2, 5, 5, true, false);
      const catLabel = idx === 0 ? `${cat.category} [Highest]` : cat.category;
      p1 += drawText(catLabel, 326, catY, "F2", 7.5, 0.15, 0.2, 0.3);
      p1 += drawText(
        `${formatCurrency(cat.total)} (${cat.percentage.toFixed(1)}%)`,
        440,
        catY,
        "F2",
        7.5,
        0.2,
        0.25,
        0.35
      );

      // Progress bar background
      p1 += setFillColor(0.92, 0.94, 0.96);
      p1 += drawRect(317, catY - 6, 225, 3.5, true, false);
      // Progress bar fill
      p1 += setFillColor(...color);
      const barW = Math.max(4, Math.round((cat.percentage / 100) * 225));
      p1 += drawRect(317, catY - 6, barW, 3.5, true, false);

      catY -= 22;
    });

    if (categoryBreakdown.length > 5) {
      p1 += drawText(
        `+ ${categoryBreakdown.length - 5} more categories in details table`,
        317,
        492,
        "F1",
        7.5,
        0.4,
        0.45,
        0.55
      );
    }
  }

  // 8. Visual Section C: Budget Overview
  p1 += setFillColor(1, 1, 1);
  p1 += setStrokeColor(0.88, 0.91, 0.94);
  p1 += drawRect(40, 396, 515, 74, true, true);
  p1 += drawText("Budget Overview", 52, 455, "F2", 11, 0.1, 0.15, 0.25);
  p1 += drawText("Performance tracking against overall spending budget", 52, 444, "F1", 7.5, 0.5, 0.55, 0.6);

  if (budget?.isSet && budget.overallBudget > 0) {
    // Budget Status Badge (Right aligned)
    const isExceeded = budget.isExceeded;
    const isApproaching = !isExceeded && budget.percentUsed >= 80;

    if (isExceeded) {
      p1 += setFillColor(0.99, 0.94, 0.94);
      p1 += setStrokeColor(0.98, 0.78, 0.78);
      p1 += drawRect(420, 444, 123, 16, true, true);
      p1 += drawText("Budget Exceeded", 432, 448, "F2", 8, 0.88, 0.11, 0.28);
    } else if (isApproaching) {
      p1 += setFillColor(1.0, 0.98, 0.92);
      p1 += setStrokeColor(0.98, 0.88, 0.65);
      p1 += drawRect(420, 444, 123, 16, true, true);
      p1 += drawText("Approaching Limit", 430, 448, "F2", 8, 0.85, 0.45, 0.05);
    } else {
      p1 += setFillColor(0.94, 0.99, 0.96);
      p1 += setStrokeColor(0.75, 0.92, 0.82);
      p1 += drawRect(420, 444, 123, 16, true, true);
      p1 += drawText("Within Budget", 438, 448, "F2", 8, 0.02, 0.59, 0.41);
    }

    // Three Metrics (Set Budget, Total Spent, Remaining Budget / Exceeded Amount)
    p1 += setFillColor(0.97, 0.98, 1.0);
    p1 += drawRect(52, 418, 145, 20, true, false);
    p1 += drawText(`Set Budget: ${formatCurrency(budget.overallBudget)}`, 58, 423, "F2", 7.5, 0.2, 0.25, 0.35);

    p1 += setFillColor(0.99, 0.95, 0.95);
    p1 += drawRect(207, 418, 145, 20, true, false);
    p1 += drawText(`Total Spent: ${formatCurrency(budget.totalSpent)}`, 213, 423, "F2", 7.5, 0.88, 0.11, 0.28);

    p1 += setFillColor(isExceeded ? 0.99 : 0.95, isExceeded ? 0.95 : 0.99, isExceeded ? 0.95 : 0.96);
    p1 += drawRect(362, 418, 181, 20, true, false);
    const remLabel = isExceeded
      ? `Exceeded: ${formatCurrency(budget.exceededAmount)}`
      : `Remaining: ${formatCurrency(budget.remainingBudget)}`;
    p1 += drawText(remLabel, 368, 423, "F2", 7.5, isExceeded ? 0.88 : 0.02, isExceeded ? 0.11 : 0.59, isExceeded ? 0.28 : 0.41);

    // Spending Consumption Progress Bar
    p1 += setFillColor(0.92, 0.94, 0.96);
    p1 += drawRect(52, 404, 491, 5, true, false);

    if (isExceeded) {
      p1 += setFillColor(0.88, 0.11, 0.28);
    } else if (isApproaching) {
      p1 += setFillColor(0.92, 0.55, 0.05);
    } else {
      p1 += setFillColor(0.02, 0.59, 0.41);
    }
    const progW = Math.max(4, Math.min(491, Math.round((budget.percentUsed / 100) * 491)));
    p1 += drawRect(52, 404, progW, 5, true, false);
  } else {
    p1 += drawText(
      "No overall budget set. Set a budget in ArthraFinance to track spending limits.",
      100,
      426,
      "F1",
      8.5,
      0.5,
      0.55,
      0.6
    );
  }

  // 9. Report Transaction Details Table (Latest 10 transactions)
  const totalCount = totalTransactionCount ?? transactions.length;
  const displayedTx = transactions.slice(0, 10);
  const displayedCount = displayedTx.length;
  const txSubtitle = `Latest ${displayedCount} transactions displayed | Total = ${totalCount} transactions`;

  p1 += setFillColor(1, 1, 1);
  p1 += setStrokeColor(0.88, 0.91, 0.94);
  p1 += drawRect(40, 48, 515, 338, true, true);
  p1 += drawText("Report Transaction Details", 52, 370, "F2", 11, 0.1, 0.15, 0.25);
  p1 += drawText(txSubtitle, 52, 359, "F1", 7.5, 0.5, 0.55, 0.6);

  // Table Column Headers
  p1 += setFillColor(0.12, 0.28, 0.75);
  p1 += drawRect(52, 336, 491, 16, true, false);
  p1 += drawText("Date", 58, 340, "F2", 7.5, 1, 1, 1);
  p1 += drawText("Description", 120, 340, "F2", 7.5, 1, 1, 1);
  p1 += drawText("Type", 240, 340, "F2", 7.5, 1, 1, 1);
  p1 += drawText("Category", 300, 340, "F2", 7.5, 1, 1, 1);
  p1 += drawText("Account", 390, 340, "F2", 7.5, 1, 1, 1);
  p1 += drawText("Amount", 485, 340, "F2", 7.5, 1, 1, 1);

  let rowY = 321;

  if (displayedTx.length === 0) {
    p1 += drawText(
      "No transactions recorded yet.",
      200,
      250,
      "F1",
      8.5,
      0.5,
      0.55,
      0.6
    );
  } else {
    displayedTx.forEach((tx, idx) => {
      if (idx % 2 === 1) {
        p1 += setFillColor(0.97, 0.98, 1.0);
        p1 += drawRect(52, rowY - 3.5, 491, 14, true, false);
      }
      p1 += drawText(formatDateDMY(tx.date) || "—", 58, rowY, "F1", 7.5, 0.3, 0.35, 0.4);
      p1 += drawText(
        (tx.name || "Untitled").substring(0, 26),
        120,
        rowY,
        "F2",
        7.5,
        0.1,
        0.15,
        0.2
      );

      const isInc = tx.type === "Income";
      p1 += drawText(
        tx.type,
        240,
        rowY,
        "F2",
        7,
        isInc ? 0.02 : 0.88,
        isInc ? 0.59 : 0.11,
        isInc ? 0.41 : 0.28
      );
      p1 += drawText(
        (tx.category || "—").substring(0, 16),
        300,
        rowY,
        "F1",
        7.5,
        0.3,
        0.35,
        0.4
      );
      p1 += drawText(
        (tx.account || "Account").substring(0, 18),
        390,
        rowY,
        "F1",
        7.5,
        0.3,
        0.35,
        0.4
      );

      const amtStr = `${isInc ? "+ " : "- "}${formatCurrency(Number(tx.amount || 0))}`;
      p1 += drawText(
        amtStr,
        475,
        rowY,
        "F2",
        7.5,
        isInc ? 0.02 : 0.88,
        isInc ? 0.59 : 0.11,
        isInc ? 0.41 : 0.28
      );

      rowY -= 14.5;
    });
  }

  // Page 1 Footer
  p1 += setStrokeColor(0.85, 0.88, 0.93);
  p1 += drawLine(40, 38, 555, 38, 1);
  p1 += drawText(
    `ArthraFinance Report • Page 1 • Generated for ${userName} • Confidential`,
    40,
    26,
    "F1",
    7.5,
    0.5,
    0.55,
    0.6
  );
  p1 += drawText("Powered by ArthraFinance", 450, 26, "F2", 7.5, 0.15, 0.35, 0.85);

  pages.push(p1);

  // =========================================================================
  // ASSEMBLE PDF STRUCTURE & CROSS-REFERENCE (XREF) TABLE
  // =========================================================================
  const objects: string[] = [];
  function addObj(str: string): number {
    objects.push(str);
    return objects.length;
  }

  const fontHelvetica = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontHelveticaBold = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectIds: number[] = [];
  const streamObjectIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    // Length in bytes
    const streamLen = new TextEncoder().encode(pages[i]).length;
    const streamId = addObj(`<< /Length ${streamLen} >>\nstream\n${pages[i]}\nendstream`);
    streamObjectIds.push(streamId);
  }

  // Placeholder for the pages tree object
  const pagesTreePlaceholderId = objects.length + pages.length + 1;

  for (let i = 0; i < pages.length; i++) {
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesTreePlaceholderId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontHelvetica} 0 R /F2 ${fontHelveticaBold} 0 R >> >> /Contents ${streamObjectIds[i]} 0 R >>`
    );
    pageObjectIds.push(pageId);
  }

  const pagesTreeObj = addObj(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );
  const catalogObj = addObj(`<< /Type /Catalog /Pages ${pagesTreeObj} 0 R >>`);

  // Build binary string with exact byte offsets
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

/**
 * Downloads the generated PDF directly to the user's browser without opening
 * the print dialog or showing any print settings.
 */
export function downloadFinancialReportPdf(
  data: ReportPdfData,
  fileName = "ArthraFinance_Financial_Report.pdf"
): void {
  const pdfString = buildFinancialReportPdfString(data);
  const bytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) {
    bytes[i] = pdfString.charCodeAt(i) & 0xff;
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up object URL memory
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

