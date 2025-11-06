export const toNum = (x: any) => {
  if (x == null) return NaN;
  const s = String(x).replace(/[,₹\s]/g,"");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};