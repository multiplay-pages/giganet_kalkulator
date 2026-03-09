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
  wifiCount: 0,
  wifiInstallType: "self",
  security: "off",
  promoMonths1zl: 0,
  promoWifiMonths: 0
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
    wifi_monthly_per_unit: 10,
    wifi_activation_per_unit: 89,
    wifi_technician_trip: 100
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
  const num = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${num.toFixed(2).replace(".", ",")} zł`;
}

function getAddonPrice(...keys) {
  for (const key of keys) {
    const value = Number(priceConfig.addonPrices?.[key]);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
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

  const wifiMonthlyPerUnit = getAddonPrice("wifi_monthly_per_unit", "wifiPremiumMonthly");
  const wifiActivationPerUnit = getAddonPrice("wifi_activation_per_unit", "wifiPremiumActivation");
  const wifiTechnicianTrip = getAddonPrice("wifi_technician_trip");

  const wifiPremium = state.wifiCount > 0 ? state.wifiCount * wifiMonthlyPerUnit : 0;

  const addons = symmetric + security + internetPlus + wifiPremium;
  const monthly = base + consents + phone + addons;

  const install =
    state.status === "Nowy"
      ? priceConfig.installationPrices.newCustomer
      : priceConfig.installationPrices.existingCustomer;

  const activation = state.wifiCount > 0 ? state.wifiCount * wifiActivationPerUnit : 0;
  const wifiTechnician =
    state.wifiCount > 0 && state.wifiInstallType === "technician" ? wifiTechnicianTrip : 0;
  const oneTime = install + activation + wifiTechnician;

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
    wifiTechnician,
    oneTime
  };
}

function normalizeState() {
  const symmetricLocked = state.tariff === "2000/2000";

  if (symmetricLocked) {
    state.symmetric = false;
  }

  const renewalAllowed = !symmetricLocked && state.symmetric && state.status === "Obecny";

  if (!renewalAllowed) {
    state.renewalDiscount = false;
  }

  if (state.promoMonths1zl > state.commitment) {
    state.promoMonths1zl = 0;
  }

  if (state.promoWifiMonths > state.commitment) {
    state.promoWifiMonths = 0;
  }

  if (state.wifiCount < 0 || state.wifiCount > 5) {
    state.wifiCount = 0;
  }

  state.wifiPremium = state.wifiCount > 0;

  if (!["self", "technician"].includes(state.wifiInstallType)) {
    state.wifiInstallType = "self";
  }

  if (state.wifiCount === 0) {
    state.wifiInstallType = "self";
  }

  if (!state.wifiPremium) {
    state.promoWifiMonths = 0;
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
  const renewalAllowed = !symmetricLocked && state.symmetric && state.status === "Obecny";

  if (symmetricButton) {
    symmetricButton.classList.toggle("disabled", symmetricLocked);

    if (symmetricLocked) {
      symmetricButton.classList.remove("active");
    }
  }

  if (renewalButton) {
    renewalButton.classList.toggle("disabled", !renewalAllowed);
  }

  if (renewalNote) {
    if (symmetricLocked) {
      renewalNote.textContent =
        "Taryfa 2000/2000 jest już łączem symetrycznym, więc dodatkowa opcja „Łącze symetryczne” jest niedostępna.";
    } else if (renewalAllowed) {
      renewalNote.textContent = "Rabat odnowieniowy jest dostępny dla tej konfiguracji.";
    } else {
      renewalNote.textContent =
        "Rabat odnowieniowy działa tylko dla obecnego klienta przy aktywnym łączu symetrycznym.";
    }
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
    calc.consents > 0 ? `+ ${formatMoney(calc.consents)}` : formatMoney(0);
  document.getElementById("line-phone").textContent =
    calc.phone > 0 ? `+ ${formatMoney(calc.phone)}` : formatMoney(0);
  document.getElementById("line-addons").textContent =
    calc.addons > 0 ? `+ ${formatMoney(calc.addons)}` : formatMoney(0);
  document.getElementById("line-install").textContent = formatMoney(calc.install);
  document.getElementById("line-activation").textContent =
    calc.activation > 0 ? `+ ${formatMoney(calc.activation)}` : formatMoney(0);

  const wifiMonthlyRow = document.getElementById("line-wifi-monthly-row");
  const wifiActivationRow = document.getElementById("line-wifi-activation-row");
  const wifiTechnicianRow = document.getElementById("line-wifi-technician-row");

  if (state.wifiCount > 0) {
    wifiMonthlyRow.style.display = "flex";
    wifiActivationRow.style.display = "flex";
    document.getElementById("line-wifi-monthly-label").textContent = `WiFi Premium (${state.wifiCount}x)`;
    document.getElementById("line-wifi-monthly").textContent = `+ ${formatMoney(calc.wifiPremium)}`;
    document.getElementById("line-wifi-activation-label").textContent =
      `Aktywacja WiFi Premium (${state.wifiCount}x)`;
    document.getElementById("line-wifi-activation").textContent = `+ ${formatMoney(calc.activation)}`;
  } else {
    wifiMonthlyRow.style.display = "none";
    wifiActivationRow.style.display = "none";
  }

  if (calc.wifiTechnician > 0) {
    wifiTechnicianRow.style.display = "flex";
    document.getElementById("line-wifi-technician").textContent = `+ ${formatMoney(calc.wifiTechnician)}`;
  } else {
    wifiTechnicianRow.style.display = "none";
  }
}

function updateWifiPremiumControls() {
  const wifiCountSlider = document.getElementById("wifi-count-slider");
  const wifiCountValue = document.getElementById("wifi-count-value");
  const wifiInstallWrap = document.getElementById("wifi-install-wrap");

  if (!wifiCountSlider || !wifiCountValue || !wifiInstallWrap) {
    return;
  }

  wifiCountSlider.value = state.wifiCount;
  wifiCountValue.textContent = `${state.wifiCount} szt.`;

  wifiInstallWrap.classList.toggle("disabled", state.wifiCount === 0);

  document.querySelectorAll(".wifi-install-option").forEach((button) => {
    const isActive = button.dataset.installType === state.wifiInstallType;
    button.classList.toggle("active", isActive);
    button.disabled = state.wifiCount === 0;
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updatePromoSliders(calc) {
  const promo1zlSlider = document.getElementById("promo1zl-slider");
  const promoWifiSlider = document.getElementById("promoWifi-slider");
  const promoWifiGroup = document.getElementById("promo-wifi-group");
  const promo1zlValue = document.getElementById("promo1zl-value");
  const promoWifiValue = document.getElementById("promoWifi-value");
  const promo1zlSaving = document.getElementById("promo1zl-saving");
  const promoWifiSaving = document.getElementById("promoWifi-saving");
  const avgMonthly = document.getElementById("avg-monthly");
  const totalPromoSavingEl = document.getElementById("total-promo-saving");

  if (
    !promo1zlSlider ||
    !promoWifiSlider ||
    !promoWifiGroup ||
    !promo1zlValue ||
    !promoWifiValue ||
    !promo1zlSaving ||
    !promoWifiSaving ||
    !avgMonthly ||
    !totalPromoSavingEl
  ) {
    return;
  }

  const okres = Number(state.commitment) || 1;
  const mies1zl = Math.max(0, Math.min(Number(state.promoMonths1zl) || 0, okres));
  const miesWifi = Math.max(0, Math.min(Number(state.promoWifiMonths) || 0, okres));

  state.promoMonths1zl = mies1zl;
  state.promoWifiMonths = miesWifi;

  promo1zlSlider.min = 0;
  promo1zlSlider.step = 1;
  promo1zlSlider.max = okres;
  promo1zlSlider.value = mies1zl;

  promoWifiSlider.min = 0;
  promoWifiSlider.step = 1;
  promoWifiSlider.max = okres;
  promoWifiSlider.value = miesWifi;

  promoWifiGroup.style.display = state.wifiPremium ? "block" : "none";
  promoWifiSlider.disabled = !state.wifiPremium;

  const wifiMonthlyTotal = Math.max(0, Number(calc.wifiPremium) || 0);
  const monthlyWithoutWifi = Math.max(0, (Number(calc.monthly) || 0) - wifiMonthlyTotal);

  const saving1zl = mies1zl * Math.max(0, monthlyWithoutWifi - 1);
  const savingWifi = miesWifi * Math.max(0, wifiMonthlyTotal - 1);
  const totalPromoSaving = saving1zl + savingWifi;
  const usredniona = Math.max(0, (Number(calc.monthly) || 0) - totalPromoSaving / okres);

  promo1zlValue.textContent = `${mies1zl} mies.`;
  promoWifiValue.textContent = `${miesWifi} mies.`;
  promo1zlSaving.textContent = `Oszczędność: ${formatMoney(saving1zl)}`;
  promoWifiSaving.textContent = `Oszczędność: ${formatMoney(savingWifi)}`;
  avgMonthly.textContent = `${formatMoney(usredniona)} / mies.`;
  totalPromoSavingEl.textContent = formatMoney(totalPromoSaving);
}

function render() {
  normalizeState();
  const calc = calculate();

  updateSelectCards();
  updateToggleCards();
  updateSummary(calc);
  updateWifiPremiumControls();
  updatePromoSliders(calc);
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

function bindWifiPremiumControls() {
  const wifiCountSlider = document.getElementById("wifi-count-slider");

  if (!wifiCountSlider) {
    return;
  }

  wifiCountSlider.addEventListener("input", () => {
    const previousCount = state.wifiCount;
    state.wifiCount = Number(wifiCountSlider.value);

    if (state.wifiCount === 0 || previousCount === 0) {
      state.wifiInstallType = "self";
    }

    render();
  });

  document.querySelectorAll(".wifi-install-option").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.wifiCount === 0) {
        return;
      }

      state.wifiInstallType = button.dataset.installType;
      render();
    });
  });
}

function bindPromoSliders() {
  const promo1zlSlider = document.getElementById("promo1zl-slider");
  const promoWifiSlider = document.getElementById("promoWifi-slider");

  if (!promo1zlSlider || !promoWifiSlider) {
    return;
  }

  promo1zlSlider.addEventListener("input", () => {
    state.promoMonths1zl = Number(promo1zlSlider.value);
    render();
  });

  promoWifiSlider.addEventListener("input", () => {
    state.promoWifiMonths = Number(promoWifiSlider.value);
    render();
  });
}

async function initCalculator() {
  await loadPriceConfig();
  bindSelectCards();
  bindToggleCards();
  bindWifiPremiumControls();
  bindPromoSliders();
  render();
}

initCalculator();
