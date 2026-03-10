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
  promotionType: "none",
  promotionGiftType: "subscription_discount",
  externalRemainingMonths: 1,
  bannerPromoEnabled: false
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
  phonePrices: { off: 0, UE60: 9.99, UE300: 14.99, NoLimit: 19.99 },
  securityPrices: { off: 0, is1: 9, is3: 14.99, mobile: 6, family: 20, mac1: 9, mac3: 14.99 },
  consentPenalties: { efaktura: 10, marketing: 5 },
  addonPrices: {
    symmetricDefault: 10,
    symmetricRenewal: 5,
    internetPlus: 10,
    wifi_monthly_per_unit: 10,
    wifi_activation_per_unit: 89,
    wifi_technician_trip: 100
  },
  installationPrices: { newCustomer: 249, existingCustomer: 0 }
};

const promotionDefinitions = {
  none: { label: "Brak promocji", eligibility: "both", blocksConsents: false, scopes: [] },
  six_for_one: { label: "6 za 1", eligibility: "new", blocksConsents: true, scopes: ["all_services_except"] },
  ztr_2026: { label: "ZTR 2026", eligibility: "new", blocksConsents: true, scopes: ["all_services_except"] },
  comeback_multiplay: {
    label: "Powrót do Multiplay",
    eligibility: "new",
    blocksConsents: true,
    scopes: ["all_services_except", "one_time_fee"]
  },
  choose_gift: {
    label: "Wybierz swój prezent",
    eligibility: "existing",
    blocksConsents: false,
    scopes: ["gift"]
  }
};

const additionalPromotionDefinitions = {
  banner: {
    label: "Promocja Banerowa",
    eligibility: "both",
    blocksConsents: true,
    scopes: ["all_services_except"],
    duration: 1
  }
};

const giftDefinitions = {
  subscription_discount: {
    label: "Rabat abonamentowy",
    scope: "all_services_except",
    isFinancial: true,
    blocksConsents: true
  },
  wifi_premium_discount: {
    label: "Rabat na usługę WiFi Premium",
    scope: "specific_service_single_unit",
    isFinancial: true,
    blocksConsents: false
  },
  multiroom_discount: {
    label: "Rabat na usługę Multiroom (niedostępny w tym kalkulatorze)",
    scope: "specific_service_single_unit",
    isFinancial: true,
    availableInCalculator: false,
    blocksConsents: false
  },
  router_replacement: {
    label: "Wymiana routera",
    scope: "hardware_benefit",
    isFinancial: false,
    blocksConsents: false
  }
};

const compatibilityMatrix = {
  six_for_one: ["banner"],
  ztr_2026: ["banner"],
  comeback_multiplay: ["banner"],
  choose_gift: ["banner"]
};

let priceConfig = fallbackPriceConfig;

function isValidPriceConfig(config) {
  return Boolean(
    config?.basePrices &&
    config?.phonePrices &&
    config?.securityPrices &&
    config?.consentPenalties &&
    config?.addonPrices &&
    config?.installationPrices
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
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function isPromotionEligible(type) {
  const eligibility = promotionDefinitions[type]?.eligibility;
  if (eligibility === "both") return true;
  if (eligibility === "new") return state.status === "Nowy";
  if (eligibility === "existing") return state.status === "Obecny";
  return false;
}

function canCombinePromotions(mainType, secondaryType) {
  if (!mainType || !secondaryType || mainType === "none") return false;
  return (compatibilityMatrix[mainType] || []).includes(secondaryType);
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

  if (state.wifiCount < 0 || state.wifiCount > 5) {
    state.wifiCount = 0;
  }
  state.wifiPremium = state.wifiCount > 0;

  if (!["self", "technician"].includes(state.wifiInstallType) || state.wifiCount === 0) {
    state.wifiInstallType = "self";
  }

  if (!isPromotionEligible(state.promotionType)) {
    state.promotionType = "none";
    state.bannerPromoEnabled = false;
  }

  if (state.promotionType !== "choose_gift") {
    state.promotionGiftType = "subscription_discount";
  }

  const gift = giftDefinitions[state.promotionGiftType];
  if (!gift || gift.availableInCalculator === false) {
    state.promotionGiftType = "subscription_discount";
  }

  state.externalRemainingMonths = Math.max(1, Number(state.externalRemainingMonths) || 1);

  if (!canCombinePromotions(state.promotionType, "banner")) {
    state.bannerPromoEnabled = false;
  }
}

function calculateBaseCosts() {
  const base = priceConfig.basePrices[state.commitment][state.building][state.tariff];
  const consentPenalty = priceConfig.consentPenalties.efaktura + priceConfig.consentPenalties.marketing;
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

  const wifiPremium = state.wifiCount * wifiMonthlyPerUnit;
  const addons = symmetric + security + internetPlus + wifiPremium;
  const monthly = base + consents + phone + addons;
  const monthlyWithoutConsentDiscounts = base + consentPenalty + phone + addons;

  const install =
    state.status === "Nowy"
      ? priceConfig.installationPrices.newCustomer
      : priceConfig.installationPrices.existingCustomer;

  const activation = state.wifiCount * wifiActivationPerUnit;
  const wifiTechnician =
    state.wifiCount > 0 && state.wifiInstallType === "technician"
      ? wifiTechnicianTrip
      : 0;

  return {
    base,
    consentPenalty,
    consents,
    symmetric,
    phone,
    security,
    internetPlus,
    wifiPremium,
    addons,
    monthly,
    monthlyWithoutConsentDiscounts,
    install,
    activation,
    wifiTechnician,
    oneTime: install + activation + wifiTechnician,
    wifiMonthlyPerUnit
  };
}

function getPromotionDuration(type) {
  if (type === "six_for_one") return state.commitment === 24 ? 6 : 3;
  if (type === "ztr_2026") return Math.min(12, state.externalRemainingMonths, state.commitment);
  if (type === "comeback_multiplay") return Math.min(24, state.externalRemainingMonths + 3, state.commitment);

  if (type === "choose_gift") {
    if (state.promotionGiftType === "subscription_discount") return 1;
    if (state.promotionGiftType === "wifi_premium_discount") return 12;
    if (state.promotionGiftType === "multiroom_discount") return 9;
    if (state.promotionGiftType === "router_replacement") return 0;
  }

  return 0;
}

function getMainSubscriptionPromotionMonths() {
  if (["six_for_one", "ztr_2026", "comeback_multiplay"].includes(state.promotionType)) {
    return getPromotionDuration(state.promotionType);
  }

  if (state.promotionType === "choose_gift" && state.promotionGiftType === "subscription_discount") {
    return getPromotionDuration("choose_gift");
  }

  return 0;
}

function getBannerExtensionMonths() {
  const isAllowed = canCombinePromotions(state.promotionType, "banner");

  if (!state.bannerPromoEnabled || !isAllowed) {
    return 0;
  }

  return additionalPromotionDefinitions.banner.duration;
}

function buildSubscriptionPromoSchedule() {
  const mainMonths = Math.min(getMainSubscriptionPromotionMonths(), state.commitment);
  const bannerMonths = getBannerExtensionMonths();
  const totalMonths = Math.min(state.commitment, mainMonths + bannerMonths);

  return {
    mainMonths,
    bannerMonths,
    totalMonths
  };
}

function getActivePromotions() {
  const promotions = [];

  if (state.promotionType !== "none") {
    promotions.push({
      type: state.promotionType,
      duration: getPromotionDuration(state.promotionType)
    });
  }

  if (state.bannerPromoEnabled && canCombinePromotions(state.promotionType, "banner")) {
    promotions.push({
      type: "banner",
      duration: additionalPromotionDefinitions.banner.duration
    });
  }

  return promotions;
}

function applyPromotionsForMonth(baseCalc, month, activePromotions, subscriptionSchedule) {
  let monthPrice = baseCalc.monthly;
  let blocksConsents = false;
  let nonFinancialBenefits = [];

  if (month <= subscriptionSchedule.totalMonths) {
    monthPrice = 1;
    blocksConsents = true;
  }

  for (const promo of activePromotions) {
    const shouldTreatZeroDurationAsOneTime =
      promo.type === "choose_gift" && state.promotionGiftType === "router_replacement";

    const active = shouldTreatZeroDurationAsOneTime ? month === 1 : month <= promo.duration;
    if (!active) continue;

    if (
      promotionDefinitions[promo.type]?.blocksConsents ||
      additionalPromotionDefinitions[promo.type]?.blocksConsents
    ) {
      blocksConsents = true;
    }

    if (promo.type === "choose_gift") {
      const gift = giftDefinitions[state.promotionGiftType];
      if (!gift) continue;

      blocksConsents = blocksConsents || gift.blocksConsents;

      if (state.promotionGiftType === "subscription_discount") {
        monthPrice = 1;
      } else if (state.promotionGiftType === "wifi_premium_discount" && state.wifiCount > 0 && monthPrice !== 1) {
        monthPrice -= baseCalc.wifiMonthlyPerUnit;
        monthPrice += 1;
      } else if (state.promotionGiftType === "router_replacement") {
        nonFinancialBenefits.push(gift.label);
      }
    }
  }

  if (blocksConsents && monthPrice !== 1) {
    monthPrice += baseCalc.consentPenalty - baseCalc.consents;
  }

  return {
    finalMonthly: Number(Math.max(0, monthPrice).toFixed(2)),
    savings: Number(Math.max(0, baseCalc.monthly - Math.max(0, monthPrice)).toFixed(2)),
    nonFinancialBenefits
  };
}

function buildMonthlyTimeline(baseCalc, activePromotions) {
  const subscriptionSchedule = buildSubscriptionPromoSchedule();
  const rows = [];
  let totalSavings = 0;
  let nonFinancialBenefits = new Set();

  for (let month = 1; month <= state.commitment; month += 1) {
    const result = applyPromotionsForMonth(baseCalc, month, activePromotions, subscriptionSchedule);
    rows.push(result.finalMonthly);
    totalSavings += result.savings;
    result.nonFinancialBenefits.forEach((name) => nonFinancialBenefits.add(name));
  }

  if (activePromotions.some((promo) => promo.type === "comeback_multiplay")) {
    const installSaving = Math.max(0, baseCalc.install - 1);
    totalSavings += installSaving;
  }

  return {
    rows,
    totalSavings: Number(totalSavings.toFixed(2)),
    avgMonthly: Number((rows.reduce((sum, value) => sum + value, 0) / state.commitment).toFixed(2)),
    nonFinancialBenefits: [...nonFinancialBenefits],
    subscriptionSchedule
  };
}

function groupPromoPeriods(monthlyRows) {
  if (!monthlyRows.length) return [];

  const groups = [];
  let start = 1;
  let current = monthlyRows[0];

  for (let i = 1; i < monthlyRows.length; i += 1) {
    if (monthlyRows[i] !== current) {
      groups.push({ start, end: i, price: current });
      start = i + 1;
      current = monthlyRows[i];
    }
  }

  groups.push({ start, end: monthlyRows.length, price: current });
  return groups;
}

function renderPromoPeriods(groups) {
  const list = document.getElementById("promo-periods-list");
  if (!list) return;

  list.innerHTML = groups
    .map(({ start, end, price }) => {
      const rangeLabel = start === end ? `${start} mies.` : `${start}–${end} mies.`;
      return `<div class="promo-period-row"><span class="promo-period-range">${rangeLabel}</span><strong class="promo-period-price">${formatMoney(price)} / mies.</strong></div>`;
    })
    .join("");
}

function updateSelectCards() {
  document.querySelectorAll(".select-card[data-group]").forEach((button) => {
    const group = button.dataset.group;
    let value = button.dataset.value;

    if (group === "commitment") value = Number(value);
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

  if (symmetricButton) symmetricButton.classList.toggle("disabled", symmetricLocked);
  if (renewalButton) renewalButton.classList.toggle("disabled", !renewalAllowed);

  if (renewalNote) {
    renewalNote.textContent = symmetricLocked
      ? "Taryfa 2000/2000 jest już łączem symetrycznym, więc dodatkowa opcja „Łącze symetryczne” jest niedostępna."
      : renewalAllowed
        ? "Rabat odnowieniowy jest dostępny dla tej konfiguracji."
        : "Rabat odnowieniowy działa tylko dla obecnego klienta przy aktywnym łączu symetrycznym.";
  }
}

function updateWifiPremiumControls() {
  const wifiCountSlider = document.getElementById("wifi-count-slider");
  const wifiCountValue = document.getElementById("wifi-count-value");
  const wifiInstallWrap = document.getElementById("wifi-install-wrap");

  if (!wifiCountSlider || !wifiCountValue || !wifiInstallWrap) return;

  wifiCountSlider.value = state.wifiCount;
  wifiCountValue.textContent = `${state.wifiCount} szt.`;
  wifiInstallWrap.classList.toggle("disabled", state.wifiCount === 0);

  document.querySelectorAll(".wifi-install-option").forEach((button) => {
    const active = button.dataset.installType === state.wifiInstallType;
    button.classList.toggle("active", active);
    button.disabled = state.wifiCount === 0;
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderPromotionConfigurator() {
  const select = document.getElementById("promotion-type-select");
  const helper = document.getElementById("promotion-type-helper");
  const configFields = document.getElementById("promotion-config-fields");
  const notes = document.getElementById("promotion-business-notes");

  if (!select || !helper || !configFields || !notes) return;

  const options = ["none", "six_for_one", "ztr_2026", "comeback_multiplay", "choose_gift"];

  select.innerHTML = options
    .map((type) => {
      const disabled = !isPromotionEligible(type);
      return `<option value="${type}" ${disabled ? "disabled" : ""}>${promotionDefinitions[type].label}${disabled ? " (niedostępna dla tego statusu)" : ""}</option>`;
    })
    .join("");

  select.value = state.promotionType;

  helper.textContent = state.status === "Nowy"
    ? "Dla nowego klienta niedostępny jest wariant „Wybierz swój prezent”."
    : "Dla obecnego klienta niedostępne są promocje: 6 za 1, ZTR 2026 i Powrót do Multiplay.";

  const parts = [];

  if (["ztr_2026", "comeback_multiplay"].includes(state.promotionType)) {
    parts.push(`
      <label class="block-label" for="external-months-input">Miesiące pozostałe u obecnego operatora</label>
      <input id="external-months-input" class="promo-input" type="number" min="1" max="30" value="${state.externalRemainingMonths}" />
      <div class="helper-text">${state.promotionType === "ztr_2026" ? "Maksymalnie 12 miesięcy promocji." : "Promocja = wpisane miesiące + 3, maksymalnie 24 miesiące."}</div>
    `);
  }

  if (state.promotionType === "choose_gift") {
    const giftOptions = Object.entries(giftDefinitions)
      .map(([key, gift]) => `<option value="${key}" ${gift.availableInCalculator === false ? "disabled" : ""}>${gift.label}</option>`)
      .join("");

    parts.push(`
      <label class="block-label" for="promotion-gift-select">Wybierz jeden prezent</label>
      <select id="promotion-gift-select" class="promo-select">${giftOptions}</select>
      <div class="helper-text">Możesz wybrać dokładnie 1 prezent. Rabat WiFi dotyczy tylko 1 urządzenia MESH, pozostałe wg cennika.</div>
    `);
  }

  if (canCombinePromotions(state.promotionType, "banner")) {
    parts.push(`
      <label class="promo-checkbox-row">
        <input type="checkbox" id="banner-combined-checkbox" ${state.bannerPromoEnabled ? "checked" : ""} />
        <span>Połącz z „Promocją Banerową” (1 mies. za 1 zł)</span>
      </label>
      <div class="helper-text">Promocja Banerowa dodaje 1 dodatkowy miesiąc abonamentu za 1 zł po zakończeniu głównej promocji abonamentowej.</div>
    `);
  }

  configFields.innerHTML = parts.join("");

  const businessNotes = [];
  const selectedPromo = promotionDefinitions[state.promotionType];

  if (selectedPromo?.blocksConsents || (state.promotionType === "choose_gift" && giftDefinitions[state.promotionGiftType]?.blocksConsents)) {
    businessNotes.push("W okresie promocyjnym wyłączone są rabaty marketing i e-faktura.");
  }

  if (!canCombinePromotions(state.promotionType, "banner") && state.promotionType !== "none") {
    businessNotes.push("Wybrana promocja nie łączy się z dodatkowymi promocjami.");
  }

  notes.textContent = businessNotes.join(" ");

  const giftSelect = document.getElementById("promotion-gift-select");
  if (giftSelect) {
    giftSelect.value = state.promotionGiftType;
  }
}

function updateSummary(baseCalc, timeline, activePromotions) {
  document.getElementById("detail-commitment").textContent = `${state.commitment} miesięcy`;
  document.getElementById("detail-building").textContent = state.building === "SFH" ? "Domek (SFH)" : "Blok (MFH)";
  document.getElementById("detail-status").textContent = state.status === "Nowy" ? "Nowy klient" : "Obecny klient";
  document.getElementById("detail-tariff").textContent = state.tariff;

  const oneTimeFinal = activePromotions.some((p) => p.type === "comeback_multiplay")
    ? 1 + baseCalc.activation + baseCalc.wifiTechnician
    : baseCalc.oneTime;

  document.getElementById("monthly-total").textContent = formatMoney(timeline.rows[0] ?? baseCalc.monthly);
  document.getElementById("one-time-total").textContent = formatMoney(oneTimeFinal);

  document.getElementById("line-base").textContent = formatMoney(baseCalc.base);
  document.getElementById("line-consents").textContent = baseCalc.consents > 0 ? `+ ${formatMoney(baseCalc.consents)}` : formatMoney(0);
  document.getElementById("line-phone").textContent = baseCalc.phone > 0 ? `+ ${formatMoney(baseCalc.phone)}` : formatMoney(0);
  document.getElementById("line-addons").textContent = baseCalc.addons > 0 ? `+ ${formatMoney(baseCalc.addons)}` : formatMoney(0);
  document.getElementById("line-install").textContent = formatMoney(oneTimeFinal - baseCalc.activation - baseCalc.wifiTechnician);
  document.getElementById("line-activation").textContent = baseCalc.activation > 0 ? `+ ${formatMoney(baseCalc.activation)}` : formatMoney(0);

  const wifiMonthlyRow = document.getElementById("line-wifi-monthly-row");
  const wifiActivationRow = document.getElementById("line-wifi-activation-row");
  const wifiTechnicianRow = document.getElementById("line-wifi-technician-row");

  if (state.wifiCount > 0) {
    wifiMonthlyRow.style.display = "flex";
    wifiActivationRow.style.display = "flex";
    document.getElementById("line-wifi-monthly-label").textContent = `WiFi Premium (${state.wifiCount}x)`;
    document.getElementById("line-wifi-monthly").textContent = `+ ${formatMoney(baseCalc.wifiPremium)}`;
    document.getElementById("line-wifi-activation-label").textContent = `Aktywacja WiFi Premium (${state.wifiCount}x)`;
    document.getElementById("line-wifi-activation").textContent = `+ ${formatMoney(baseCalc.activation)}`;
  } else {
    wifiMonthlyRow.style.display = "none";
    wifiActivationRow.style.display = "none";
  }

  if (baseCalc.wifiTechnician > 0) {
    wifiTechnicianRow.style.display = "flex";
    document.getElementById("line-wifi-technician").textContent = `+ ${formatMoney(baseCalc.wifiTechnician)}`;
  } else {
    wifiTechnicianRow.style.display = "none";
  }

  document.getElementById("avg-monthly").textContent = `${formatMoney(timeline.avgMonthly)} / mies.`;
  document.getElementById("total-promo-saving").textContent = formatMoney(timeline.totalSavings);
  renderPromoPeriods(groupPromoPeriods(timeline.rows));

  const activeBox = document.getElementById("active-promotion-summary");

  if (activePromotions.length === 0) {
    activeBox.innerHTML = '<div class="helper-text">Brak aktywnej promocji.</div>';
    return;
  }

  const promoRows = activePromotions.map((promo) => {
    if (promo.type === "banner") {
      const mainMonths = timeline.subscriptionSchedule.mainMonths;
      const fromMonth = mainMonths + 1;
      const toMonth = mainMonths + timeline.subscriptionSchedule.bannerMonths;
      const rangeLabel = fromMonth === toMonth ? `${fromMonth}. mies.` : `${fromMonth}–${toMonth}. mies.`;

      return `<div class="promo-summary-row"><strong>${additionalPromotionDefinitions.banner.label}</strong><span>Dodatkowy okres abonamentowy: ${rangeLabel} za 1 zł</span></div>`;
    }

    if (promo.type === "choose_gift") {
      const giftLabel = giftDefinitions[state.promotionGiftType].label;
      const giftDetails = promo.duration > 0
        ? `${giftLabel}, okres: ${promo.duration} mies.`
        : `${giftLabel}, benefit bez wpływu na miesięczny abonament`;

      return `<div class="promo-summary-row"><strong>${promotionDefinitions[promo.type].label}</strong><span>${giftDetails}</span></div>`;
    }

    return `<div class="promo-summary-row"><strong>${promotionDefinitions[promo.type].label}</strong><span>Okres: ${promo.duration} mies.</span></div>`;
  });

  if (activePromotions.some((promo) => promo.type === "comeback_multiplay")) {
    promoRows.push('<div class="promo-summary-row"><strong>Instalacja promocyjna</strong><span>1,00 zł jednorazowo</span></div>');
  }

  timeline.nonFinancialBenefits.forEach((benefit) => {
    promoRows.push(`<div class="promo-summary-row"><strong>Benefit niefinansowy</strong><span>${benefit}</span></div>`);
  });

  activeBox.innerHTML = promoRows.join("");
}

function render() {
  normalizeState();
  const baseCalc = calculateBaseCosts();
  const activePromotions = getActivePromotions();
  const timeline = buildMonthlyTimeline(baseCalc, activePromotions);

  updateSelectCards();
  updateToggleCards();
  updateWifiPremiumControls();
  renderPromotionConfigurator();
  updateSummary(baseCalc, timeline, activePromotions);
}

function bindSelectCards() {
  const buttons = document.querySelectorAll(".select-card[data-group]");

  buttons.forEach((button) => {
    const group = button.dataset.group;
    const rawValue = button.dataset.value;

    if (!group) {
      console.warn("[kalkulator] select-card bez data-group:", button);
      return;
    }

    if (!(group in state)) {
      console.warn(`[kalkulator] Nieznane data-group="${group}" (brak w state).`, button);
      return;
    }

    if (rawValue === undefined) {
      console.warn(`[kalkulator] Brak data-value dla data-group="${group}".`, button);
      return;
    }

    if (button.dataset.boundClick === "1") {
      return;
    }

    button.addEventListener("click", () => {
      let value = rawValue;
      if (group === "commitment") value = Number(value);
      state[group] = value;
      render();
    });

    button.dataset.boundClick = "1";
  });
}

function bindToggleCards() {
  const buttons = document.querySelectorAll(".toggle-card[data-toggle]");

  buttons.forEach((button) => {
    const key = button.dataset.toggle;

    if (!key) {
      console.warn("[kalkulator] toggle-card bez data-toggle:", button);
      return;
    }

    if (!(key in state)) {
      console.warn(`[kalkulator] Nieznane data-toggle="${key}" (brak w state).`, button);
      return;
    }

    if (button.dataset.boundClick === "1") {
      return;
    }

    button.addEventListener("click", () => {
      if (key === "symmetric" && state.tariff === "2000/2000") return;
      if (key === "renewalDiscount" && !(state.symmetric && state.status === "Obecny")) return;
      state[key] = !state[key];
      render();
    });

    button.dataset.boundClick = "1";
  });
}

function bindWifiPremiumControls() {
  const wifiCountSlider = document.getElementById("wifi-count-slider");
  if (!wifiCountSlider) return;

  if (wifiCountSlider.dataset.boundInput !== "1") {
    wifiCountSlider.addEventListener("input", () => {
      const previousCount = state.wifiCount;
      state.wifiCount = Number(wifiCountSlider.value);

      if (state.wifiCount === 0 || previousCount === 0) {
        state.wifiInstallType = "self";
      }

      render();
    });

    wifiCountSlider.dataset.boundInput = "1";
  }

  document.querySelectorAll(".wifi-install-option").forEach((button) => {
    if (button.dataset.boundClick === "1") return;

    button.addEventListener("click", () => {
      if (state.wifiCount === 0) return;
      state.wifiInstallType = button.dataset.installType;
      render();
    });

    button.dataset.boundClick = "1";
  });
}

function bindPromotionControls() {
  if (document.body.dataset.promotionControlsBound === "1") return;

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.id === "promotion-type-select") {
      state.promotionType = target.value;
      render();
    }

    if (target.id === "promotion-gift-select") {
      state.promotionGiftType = target.value;
      render();
    }

    if (target.id === "external-months-input") {
      state.externalRemainingMonths = Number(target.value);
      render();
    }

    if (target.id === "banner-combined-checkbox") {
      state.bannerPromoEnabled = target.checked;
      render();
    }
  });

  document.body.dataset.promotionControlsBound = "1";
}

async function initCalculator() {
  await loadPriceConfig();
  bindSelectCards();
  bindToggleCards();
  bindWifiPremiumControls();
  bindPromotionControls();
  render();
}

function startCalculatorWhenDomReady() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initCalculator();
    }, { once: true });
    return;
  }

  initCalculator();
}

startCalculatorWhenDomReady();