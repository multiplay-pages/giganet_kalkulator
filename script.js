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

const fallbackPriceConfig = {
  basePrices: {
    12: {
      SFH: { "600/100": 90, "800/200": 95, "1000/300": 105, "2000/2000": 165 },
      MFH: { "600/100": 70, "800/200": 75, "1000/300": 85, "2000/2000": 145 }
    },
    24: {
      SFH: { "600/100": 85, "800/200": 90, "1000/300": 100, "2000/2000": 160 },
      MFH: { "600/100": 65, "800/200": 70, "1000/300": 80, "2000/2000": 140 }
    }
  },
  phonePrices: {
    off: 0,
    UE60: 9.99,
    UE300: 14.99,
    NoLimit: 19.99
  },
  securityPrices: {
    off: 0,
    is1: 9,
    is3: 14.99,
    mobile: 6,
    family: 20,
    mac1: 9,
    mac3: 14.99
  },
  consentPenalties: {
    efaktura: 10,
    marketing: 5
  },
  addonPrices: {
    symmetricDefault: 10,
    symmetricRenewal: 5,
    internetPlus: 10,
    wifiPremiumMonthly: 10,
    wifiPremiumActivation: 89
  },
  installationPrices: {
    newCustomer: 249,
    existingCustomer: 0
  }
};

let priceConfig = fallbackPriceConfig;

function isValidPriceConfig(config) {
  return Boolean(
    config &&
      config.basePrices &&
      config.phonePrices &&
      config.securityPrices &&
      config.consentPenalties &&
      config.addonPrices &&
      config.installationPrices
  );
}

async function loadPriceConfig() {
  try {
    const response = await fetch("./prices.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Nie udało się pobrać prices.json (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (!isValidPriceConfig(data)) {
      throw new Error("prices.json ma niepoprawną strukturę");
    }

    priceConfig = data;
  } catch (error) {
    console.error("Używam danych awaryjnych cen.", error);
    priceConfig = fallbackPriceConfig;
  }
}

function formatMoney(value) {
  const num = Number(value);

  if (Number.isInteger(num)) {
    return `${num} zł`;
  }

  return `${num.toFixed(2).replace(".", ",")} zł`;
}

function calculate() {
  const base = priceConfig.basePrices[state.commitment][state.building][state.tariff];

  const consents =
    (state.efaktura ? 0 : priceConfig.consentPenalties.efaktura) +
    (state.marketing ? 0 : priceConfig.consentPenalties.marketing);

  let symmetric = 0;
  if (state.symmetric) {
    symmetric =
      state.status === "Obecny" && state.renewalDiscount
        ? priceConfig.addonPrices.symmetricRenewal
        : priceConfig.addonPrices.symmetricDefault;
  }

  const phone = priceConfig.phonePrices[state.phone] || 0;
  const security = priceConfig.securityPrices[state.security] || 0;
  const internetPlus = state.internetPlus ? priceConfig.addonPrices.internetPlus : 0;
  const wifiPremium = state.wifiPremium ? priceConfig.addonPrices.wifiPremiumMonthly : 0;

  const addons = symmetric + security + internetPlus + wifiPremium;
  const monthly = base + consents + phone + addons;

  const install =
    state.status === "Nowy"
      ? priceConfig.installationPrices.newCustomer
      : priceConfig.installationPrices.existingCustomer;
  const activation = state.wifiPremium ? priceConfig.addonPrices.wifiPremiumActivation : 0;
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
  const symmetricLocked = state.tariff === "2000/2000";

  if (symmetricLocked) {
    state.symmetric = false;
  }

  const renewalAllowed =
    !symmetricLocked &&
    state.symmetric &&
    state.status === "Obecny";

  if (!renewalAllowed) {
    state.renewalDiscount = false;
  }
}

function updateSelectCards() {
  document.querySelectorAll(".select-card[data-group]").forEach((button) => {
    const group = button.dataset.group;
    let value = button.dataset.value;

    if (group === "commitment") {
      value = Number(value);
    }

    button.classList.toggle("active", state[group] === value);
  });
}

function updateToggleCards() {
  document.querySelectorAll(".toggle-card[data-toggle]").forEach((button) => {
    const key = button.dataset.toggle;
    button.classList.toggle("active", Boolean(state[key]));
  });

  const symmetricButton = document.querySelector('.toggle-card[data-toggle="symmetric"]');
  const renewalButton = document.getElementById("renewal-discount-btn");
  const renewalNote = document.getElementById("renewal-note");

  const symmetricLocked = state.tariff === "2000/2000";
  const renewalAllowed =
    !symmetricLocked &&
    state.symmetric &&
    state.status === "Obecny";

  if (symmetricButton) {
    symmetricButton.classList.toggle("disabled", symmetricLocked);

    if (symmetricLocked) {
      symmetricButton.classList.remove("active");
    }
  }

  renewalButton.classList.toggle("disabled", !renewalAllowed);

  if (symmetricLocked) {
    renewalNote.textContent =
      "Taryfa 2000/2000 jest już łączem symetrycznym, więc dodatkowa opcja „Łącze symetryczne” jest niedostępna.";
  } else if (renewalAllowed) {
    renewalNote.textContent =
      "Rabat odnowieniowy jest dostępny dla tej konfiguracji.";
  } else {
    renewalNote.textContent =
      "Rabat odnowieniowy działa tylko dla obecnego klienta przy aktywnym łączu symetrycznym.";
  }
}

function updateSummary(calc) {
  document.getElementById("detail-commitment").textContent = `${state.commitment} miesięcy`;
  document.getElementById("detail-building").textContent =
    state.building === "SFH" ? "Domek (SFH)" : "Blok (MFH)";
  document.getElementById("detail-status").textContent =
    state.status === "Nowy" ? "Nowy klient" : "Obecny klient";
  document.getElementById("detail-tariff").textContent = state.tariff;

  document.getElementById("monthly-total").textContent = formatMoney(calc.monthly);
  document.getElementById("one-time-total").textContent = formatMoney(calc.oneTime);

  document.getElementById("line-base").textContent = formatMoney(calc.base);
  document.getElementById("line-consents").textContent =
    calc.consents > 0 ? `+ ${formatMoney(calc.consents)}` : "0 zł";
  document.getElementById("line-phone").textContent =
    calc.phone > 0 ? `+ ${formatMoney(calc.phone)}` : "0 zł";
  document.getElementById("line-addons").textContent =
    calc.addons > 0 ? `+ ${formatMoney(calc.addons)}` : "0 zł";
  document.getElementById("line-install").textContent = formatMoney(calc.install);
  document.getElementById("line-activation").textContent =
    calc.activation > 0 ? `+ ${formatMoney(calc.activation)}` : "0 zł";
}

function render() {
  normalizeState();
  const calc = calculate();

  updateSelectCards();
  updateToggleCards();
  updateSummary(calc);
}

function bindSelectCards() {
  document.querySelectorAll(".select-card[data-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.group;
      let value = button.dataset.value;

      if (group === "commitment") {
        value = Number(value);
      }

      state[group] = value;
      render();
    });
  });
}

function bindToggleCards() {
  document.querySelectorAll(".toggle-card[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;

      if (key === "symmetric" && state.tariff === "2000/2000") {
        return;
      }

      if (key === "renewalDiscount" && !(state.symmetric && state.status === "Obecny")) {
        return;
      }

      state[key] = !state[key];
      render();
    });
  });
}

async function initCalculator() {
  await loadPriceConfig();
  bindSelectCards();
  bindToggleCards();
  render();
}

initCalculator();
