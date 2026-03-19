import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

export class GoogleSheetsService {
  /**
   * Reads the entire sheet specified by GOOGLE_SHEET_NAME, dynamically
   * locates the tracking column by matching the header in
   * GOOGLE_SHEET_TRACKING_COLUMN, then extracts and cleans all tracking
   * numbers from that column.
   *
   * Handles messy real-world data:
   *  - Multiple tracking numbers in one cell separated by newlines
   *  - Quantity suffixes like " x 9" or "x 1" appended to each number
   *
   * Authentication is handled via the GOOGLE_APPLICATION_CREDENTIALS
   * environment variable, which should point to a service-account JSON key.
   */
  async getTrackingNumbers(): Promise<string[]> {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID is not set in environment variables.');
    }

    const sheetName = process.env.GOOGLE_SHEET_NAME;
    if (!sheetName) {
      throw new Error('GOOGLE_SHEET_NAME is not set in environment variables.');
    }

    const trackingColumnHeader = process.env.GOOGLE_SHEET_TRACKING_COLUMN;
    if (!trackingColumnHeader) {
      throw new Error('GOOGLE_SHEET_TRACKING_COLUMN is not set in environment variables.');
    }

    // GoogleAuth automatically reads GOOGLE_APPLICATION_CREDENTIALS
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    const authClient = await auth.getClient();

    const sheets = google.sheets({ version: 'v4', auth: authClient as any });

    // Fetch the entire sheet so we can dynamically find the tracking column
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetName,
    });

    const allRows = response.data.values ?? [];

    if (allRows.length === 0) {
      return [];
    }

    // --- 1. Dynamic 2D Column Search ---
    // Scans the first 10 rows so we handle sheets where row 1 is metadata
    // and the real headers live in row 2 (or later).
    const targetHeader = process.env.GOOGLE_SHEET_TRACKING_COLUMN?.toLowerCase().trim();

    let headerRowIndex = -1;
    let trackingColumnIndex = -1;

    outer: for (let r = 0; r < Math.min(10, allRows.length); r++) {
      const row = allRows[r] as (string | undefined)[];
      for (let c = 0; c < row.length; c++) {
        if ((row[c] ?? '').toLowerCase().trim() === targetHeader) {
          headerRowIndex = r;
          trackingColumnIndex = c;
          break outer;
        }
      }
    }

    if (trackingColumnIndex === -1) {
      throw new Error('Tracking column not found in the sheet.');
    }

    // --- 2. Aggressive Data Cleaning ---
    // Start immediately after the header row
    const trackingNumbers: string[] = [];

    for (let i = headerRowIndex + 1; i < allRows.length; i++) {
      const row = allRows[i] as (string | undefined)[];
      const cellValue = row[trackingColumnIndex];

      // Skip undefined or empty cells
      if (!cellValue || cellValue.trim() === '') {
        continue;
      }

      // Split by newline to handle multiple numbers in one cell,
      // strip quantity suffixes (e.g. " x 9", "x 1"), and filter blanks
      const cleaned = cellValue
        .split('\n')
        .map((line) => line.replace(/\s+x\s*\d+$/i, '').trim())
        .filter((line) => line.length > 0);

      trackingNumbers.push(...cleaned);
    }

    return trackingNumbers;
  }
}

export const googleSheetsService = new GoogleSheetsService();
