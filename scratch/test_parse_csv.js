import * as XLSX from 'xlsx';

const sampleCsv = `Deal ID,Company,Income,Sales Representative,Industry,Solution Package,Date
3864,Alpha Corp,550000,Jitesh Chander,Technology,Enterprise Cloud,30-06-2026
3865,Beta Inc,1200000,Taniya Negi,Healthcare,Security Suite,01-07-2026`;

const workbook = XLSX.read(sampleCsv, { type: 'string' });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

console.log('Parsed Rows:', jsonRows);
