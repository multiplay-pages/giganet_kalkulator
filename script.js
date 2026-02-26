const state = {
  commitment: 24,
  building: "SFH",
  status: "Nowy",
  tariff: "600/100",
  efaktura: true,
  marketing: true,
  phone: "off",
  symmetric: false,
  renewalDiscount: false,
  internetPlus: false,
  wifiPremium: false,
  security: "off"
};

const basePrices = {
  12: {
    SFH: { "600/100": 90, "800/200": 95, "1000/300": 105, "2000/2000": 165 },
    MFH: { "600/100": 70, "800/200": 75, "1000/300": 85, "2000/2000": 145 }
  },
  24: {
    SFH: { "600/100": 85, "800/200": 90, "1000/300": 100, "2000/2000": 160 },
    MFH: { "600/100": 65, "800/200": 70, "1000/300": 80, "2000/2000": 140 }
  }
};

const phonePrices = {
  off: 0,
  UE60: 9.99,
  UE300: 14.99,
  NoLimit: 19.99
};

const securityPrices = {
  off: 0,
  is1: 9.00,
  is3: 14.99,
  mobile: 6.00,
  family: 20.00,
  mac1: 9.00,
  mac3: 14.99
};

function formatMoney(value) {
  const num = Number(value);
  if (Number.isInteger(num)) return `${num} zł`;
  return `${num.toFixed(2).replace(".", ",")} zł`;
}

function calculate() {
  const base = basePrices[state.commitment][state.building][state.tariff];

  const consents =
    (state.efaktura ? 0 : 10) +
    (state.marketing ? 0 : 5);

  let symmetric = 0;
  if (state.symmetric) {
    symmetric = (state.status === "Obecny" && state.renewalDiscount) ? 5 : 10;
  }

  const phone = phonePrices[state.phone] || 0;
  const security = securityPrices[state.security] || 0;
  const internetPlus = state.internetPlus ? 10 : 0;
  const wifiPremium = state.wifiPremium ? 20 : 0;

  const addons = symmetric + security + internetPlus + wifiPremium;
  const monthly = base + consents + phone + addons;

  const install = state.status === "Nowy" ? 249 : 0;
  const activation = state.wifiPremium ? 89 : 0;
  const oneTime = install + activation;

  return {
    base,
    consents,
    symmetric,
    phone,
    security,
    internetPlus,
    wifiPremium,
    addons,
    monthly,
    install,
    activation,
    oneTime
  };
}

function normalizeState() {
  const renewalAllowed = state.symmetric && state.status === "Obecny";
  if (!renewalAllowed) {
    state.renewalDiscount = false;
  }
}

function updateChoiceCards() {
  document.querySelectorAll(".choice-card[data-group]").forEach((btn) => {
    const group = btn.dataset.group;
    let value = btn.dataset.value;

    if (group === "commitment") {
      value = Number(value);
    }

    btn.classList.toggle("active", state[group] === value);
  });
}

function updateToggleCards() {
  document.querySelectorAll(".toggle-card[data-toggle]").forEach((btn) => {
    const key = btn.dataset.toggle;
    btn.classList.toggle("active", !!state[key]);
  });

  const renewalBtn = document.getElementById("renewal-discount-btn");
  const renewalNote = document.getElementById("renewal-note");
  const renewalAllowed = state.symmetric && state.status === "Obecny";

  renewalBtn.classList.toggle("disabled", !renewalAllowed);

  renewalNote.textContent = renewalAllowed
    ? "Rabat odnowieniowy jest dostępny dla tej konfiguracji."
    : "Rabat odnowieniowy działa tylko dla obecnego klienta przy aktywnym łączu symetrycznym.";
}

function updateSummary(calc) {
  document.getElementById("detail-commitment").textContent = `${state.commitment} miesięcy`;
  document.getElementById("detail-building").textContent = state.building === "SFH" ? "Domek (SFH)" : "Blok (MFH)";
  document.getElementById("detail-status").textContent = state.status === "Nowy" ? "Nowy klient" : "Obecny klient";
  document.getElementById("detail-tariff").textContent = state.tariff;

  document.getElementById("monthly-total").textContent = formatMoney(calc.monthly);
  document.getElementById("one-time-total").textContent = formatMoney(calc.oneTime);

  document.getElementById("line-base").textContent = formatMoney(calc.base);
  document.getElementById("line-consents").textContent = formatMoney(calc.consents);
  document.getElementById("line-phone").textContent = formatMoney(calc.phone);
  document.getElementById("line-addons").textContent = formatMoney(calc.addons);
  document.getElementById("line-install").textContent = formatMoney(calc.install);
  document.getElementById("line-activation").textContent = formatMoney(calc.activation);
}

function buildBreakdown(calc) {
  const rows = [];

  rows.push(`
    <div class="break-row">
      <span>1. Cena bazowa</span>
      <strong>${formatMoney(calc.base)}</strong>
    </div>
  `);

  rows.push(`
    <div class="break-row ${calc.consents > 0 ? "text-red-600" : "text-emerald-600"}">
      <span>2. Zgody / brak zgód</span>
      <strong>${calc.consents > 0 ? "+ " + formatMoney(calc.consents) : "0 zł"}</strong>
    </div>
  `);

  if (calc.symmetric > 0) {
    rows.push(`
      <div class="break-row text-indigo-600">
        <span>3. Łącze symetryczne</span>
        <strong>+ ${formatMoney(calc.symmetric)}</strong>
      </div>
    `);
  }

  if (calc.phone > 0) {
    rows.push(`
      <div class="break-row text-cyan-700">
        <span>4. Telefon (${state.phone})</span>
        <strong>+ ${formatMoney(calc.phone)}</strong>
      </div>
    `);
  }

  if (calc.security > 0) {
    rows.push(`
      <div class="break-row text-fuchsia-700">
        <span>5. Bezpieczeństwo (${state.security})</span>
        <strong>+ ${formatMoney(calc.security)}</strong>
      </div>
    `);
  }

  if (calc.internetPlus > 0) {
    rows.push(`
      <div class="break-row text-emerald-700">
        <span>6. Internet+</span>
        <strong>+ ${formatMoney(calc.internetPlus)}</strong>
      </div>
    `);
  }

  if (calc.wifiPremium > 0) {
    rows.push(`
      <div class="break-row text-orange-600">
        <span>7. WiFi Premium</span>
        <strong>+ ${formatMoney(calc.wifiPremium)}</strong>
      </div>
    `);
  }

  rows.push(`
    <div class="break-row" style="font-weight:800;">
      <span>Razem miesięcznie</span>
      <strong>${formatMoney(calc.monthly)}</strong>
    </div>
  `);

  rows.push(`
    <div class="break-row">
      <span>8. Instalacja</span>
      <strong>${formatMoney(calc.install)}</strong>
    </div>
  `);

  if (calc.activation > 0) {
    rows.push(`
      <div class="break-row text-orange-600">
        <span>9. Aktywacja dodatków</span>
        <strong>+ ${formatMoney(calc.activation)}</strong>
      </div>
    `);
  }

  rows.push(`
    <div class="break-row" style="font-weight:800;">
      <span>Razem jednorazowo</span>
      <strong>${formatMoney(calc.oneTime)}</strong>
    </div>
  `);

  document.getElementById("breakdown").innerHTML = rows.join("");
}

function render() {
  normalizeState();
  const calc = calculate();
  updateChoiceCards();
  updateToggleCards();
  updateSummary(calc);
  buildBreakdown(calc);
}

document.querySelectorAll(".choice-card[data-group]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.dataset.group;
    let value = btn.dataset.value;

    if (group === "commitment") {
      value = Number(value);
    }

    state[group] = value;
    render();
  });
});

document.querySelectorAll(".toggle-card[data-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.toggle;

    if (key === "renewalDiscount" && !(state.symmetric && state.status === "Obecny")) {
      return;
    }

    state[key] = !state[key];
    render();
  });
});

render();
