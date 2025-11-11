export const toNum = (x: any) => {
  if (x == null || x === "" || x === "-") return 0;
  const s = String(x).replace(/[,₹\s]/g,"");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};