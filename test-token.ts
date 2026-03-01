async function run() {
  const token = "301527|lWQBwLsYA78ma9JKhD8z3VpRI8ZSJ9V77Yx5ocga34a366c3";
  const url = "https://api.fleetrunnr.net/rest/v1/orders?order_number=865254994851397632";
  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", text);
  } catch(e) {
    console.error(e);
  }
}
run();
