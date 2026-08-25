//app/(public)/page.tsx
import { randomUUID } from "node:crypto";
import Link from "next/link";
import type { Metadata } from "next";
import ElectricityCalculator from "@/components/ElectricityCalculator";
import FaqJsonLd from "@/components/seo/FaqJsonLd";
import type { ContractOption } from "@/components/ElectricityCalculator";
import { faqByIds } from "@/lib/content/faq";
import { isOpsError } from "@/lib/ops/client";
import { loadWebsitePublicContractFeed, logWebsitePublicContractFeedError } from "@/lib/website/publicContractFeed";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Elpris idag – Billiga & datadrivna elavtal",
  description:
    "Jämför elpris idag per elområde (SE1–SE4). Gridex visar tydliga elavtal med full transparens kring pris, påslag och månadsavgift.",
  alternates: {
    canonical: "https://gridex.se",
  },
};

export default async function HomePage() {
  let options: ContractOption[] = [];
  let contractsLoadError: string | null = null;

  try {
    const feed = await loadWebsitePublicContractFeed({ context: "website home" });
    if (feed.state === "feed_loaded_with_blocked_contracts" && feed.contracts.length === 0) {
      const reference =
        feed.snapshot.upstream_request_id ??
        feed.snapshot.upstream_correlation_id ??
        (feed.snapshot.publication_revision !== null
          ? `PUB-${feed.snapshot.publication_revision}`
          : randomUUID().slice(0, 8).toUpperCase());
      contractsLoadError = `Publicerade elavtal kan inte visas just nu. Supportreferens: ${reference}.`;
    }
    options = feed.contracts.map((item) => ({
      name: item.name,
      value: item.offer_reference,
      offerReference: item.offer_reference,
      type: item.type,
      monthlyFeeSek: item.monthly_fee_sek ?? null,
      invoiceFeeSek: null,
      markupOrePerKwh: item.markup_ore_per_kwh ?? null,
      variableMarkupOrePerKwh: item.variable_markup_ore_per_kwh ?? null,
      fixedPriceOrePerKwh: item.type === "fixed" ? null : item.fixed_price_ore_per_kwh ?? null,
      monthlyFixedPriceSek: item.monthly_fixed_price_sek ?? null,
      elcertOrePerKwh: item.elcert_ore_per_kwh ?? null,
      portfolioPriceOrePerKwh: null,
      vatRate: item.vat_rate ?? null,
      pricingModel: item.pricing_model ?? null,
      spotShare: item.spot_share ?? null,
      portfolioShare: item.portfolio_share ?? null,
      customerTypes: item.customer_types ?? null,
      priceOptions: item.price_options ?? [],
      pricingComponents: item.pricing_components ?? [],
    }));
  } catch (error) {
    logWebsitePublicContractFeedError("website home", error);
    options = [];
    const reference = isOpsError(error)
      ? error.requestId ?? error.correlationId ?? randomUUID().slice(0, 8).toUpperCase()
      : randomUUID().slice(0, 8).toUpperCase();
    contractsLoadError = `Elavtalen kunde inte hämtas just nu. Supportreferens: ${reference}.`;
  }

  const faqItems = faqByIds(['elomrade', 'vad-ingar', 'avtalsskillnad', 'behover']);

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-6 py-12 md:py-16">
      <FaqJsonLd items={faqItems} />

      <HeroBlock />
      <TrustBar />
      <ElectricityCalculator
        contracts={options}
        contractsLoadError={contractsLoadError}
        showCustomerTypeSelector
        persistCheckoutContext
      />
      <HowItWorks />
      <ValueBlocks />
      <ArticleColumns />
      <HomeSeoBlocks />
      <HomeFaq items={faqItems} />
    </div>
  );
}

function HeroBlock() {
  return (
    <section className="relative grid gap-12 overflow-hidden border-b border-[var(--gx-border)] pb-14 pt-2 md:grid-cols-[minmax(0,1.22fr)_minmax(280px,0.78fr)] md:items-center md:gap-20 md:pb-20 md:pt-8">
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--gx-text-muted)]">
          <span className="h-2 w-2 shrink-0 bg-[var(--gx-accent)]" aria-hidden="true" />
          <span>Gridex AB · Elhandel i hela Sverige · SE1–SE4</span>
        </div>

        <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-[4.65rem]">
          <span className="block text-[var(--gx-text)]">Elavtal utan dolda avgifter.</span>
          <span className="mt-2 block text-[var(--gx-accent)]">Du ser priset innan du tecknar.</span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--gx-text-muted)] md:text-xl">
          Räkna på föregående månads spotpris och se påslag, avgifter och moms
          innan du går vidare. En tydligare prisbild från början, utan att du
          behöver leta efter detaljerna.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="#rakna-elpris"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--gx-radius-sm)] bg-[var(--gx-accent)] px-6 py-3 text-sm font-semibold text-[var(--gx-accent-ink)] transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-[var(--gx-accent-hover)]"
          >
            Räkna ditt elpris
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>

          <Link
            href="/elavtal"
            className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--gx-radius-sm)] border border-[var(--gx-border-strong)] px-6 py-3 text-sm font-semibold text-[var(--gx-text)] transition-[background-color,border-color] duration-200 hover:border-white/25 hover:bg-white/[0.04]"
          >
            Se våra elavtal
            <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>

        <dl className="mt-11 grid gap-0 border-y border-[var(--gx-border)] sm:grid-cols-3 sm:divide-x sm:divide-[var(--gx-border)]">
          <div className="border-b border-[var(--gx-border)] py-5 sm:border-b-0 sm:pr-6">
            <dt className="flex items-center gap-3 text-sm font-semibold text-[var(--gx-text)]">
              <span className="font-mono text-[11px] font-normal text-[var(--gx-accent)]">01</span>
              Tydliga avgifter
            </dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--gx-text-subtle)]">
              Se vad som ingår innan du tecknar.
            </dd>
          </div>
          <div className="border-b border-[var(--gx-border)] py-5 sm:border-b-0 sm:px-6">
            <dt className="flex items-center gap-3 text-sm font-semibold text-[var(--gx-text)]">
              <span className="font-mono text-[11px] font-normal text-[var(--gx-accent)]">02</span>
              Flera avtalsformer
            </dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--gx-text-subtle)]">
              Spot, portfölj eller fastpris.
            </dd>
          </div>
          <div className="py-5 sm:pl-6">
            <dt className="flex items-center gap-3 text-sm font-semibold text-[var(--gx-text)]">
              <span className="font-mono text-[11px] font-normal text-[var(--gx-accent)]">03</span>
              Anpassat efter område
            </dt>
            <dd className="mt-2 text-sm leading-6 text-[var(--gx-text-subtle)]">
              Prisbild för SE1, SE2, SE3 eller SE4.
            </dd>
          </div>
        </dl>
      </div>

      <aside className="relative md:-translate-y-3">
        <div className="h-px w-16 bg-[var(--gx-accent)]" aria-hidden="true" />
        <p className="mt-5 text-sm font-medium text-[var(--gx-text-muted)]">
          Det här ser du innan du tecknar
        </p>
        <h2 className="mt-3 max-w-sm text-2xl font-semibold tracking-[-0.025em] text-[var(--gx-text)] md:text-3xl">
          Hela prisbilden, rad för rad.
        </h2>

        <ol className="mt-7 border-y border-[var(--gx-border)]">
          <li className="group grid grid-cols-[2rem_1fr] gap-3 border-b border-[var(--gx-border)] py-5">
            <span className="font-mono text-xs text-[var(--gx-text-subtle)] transition-colors duration-200 group-hover:text-[var(--gx-accent)]">01</span>
            <div className="transition-transform duration-200 group-hover:translate-x-1">
              <div className="text-sm font-semibold text-[var(--gx-text)]">Prisgrund</div>
              <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
                Spotpris och vald avtalsform visas tydligt.
              </p>
            </div>
          </li>
          <li className="group grid grid-cols-[2rem_1fr] gap-3 border-b border-[var(--gx-border)] py-5">
            <span className="font-mono text-xs text-[var(--gx-text-subtle)] transition-colors duration-200 group-hover:text-[var(--gx-accent)]">02</span>
            <div className="transition-transform duration-200 group-hover:translate-x-1">
              <div className="text-sm font-semibold text-[var(--gx-text)]">Påslag och avgifter</div>
              <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
                Avgifterna visas separat innan du går vidare.
              </p>
            </div>
          </li>
          <li className="group grid grid-cols-[2rem_1fr] gap-3 py-5">
            <span className="font-mono text-xs text-[var(--gx-text-subtle)] transition-colors duration-200 group-hover:text-[var(--gx-accent)]">03</span>
            <div className="transition-transform duration-200 group-hover:translate-x-1">
              <div className="text-sm font-semibold text-[var(--gx-text)]">Månadsavgift och moms</div>
              <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
                Full specifikation visas före teckning.
              </p>
            </div>
          </li>
        </ol>

        <Link
          href="#rakna-elpris"
          className="group mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--gx-text)] transition-colors duration-200 hover:text-[var(--gx-accent)]"
        >
          Se ditt pris nu
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </Link>

        <p className="mt-3 max-w-sm text-xs leading-5 text-[var(--gx-text-subtle)]">
          Pris påverkas av elområde, förbrukning och vald avtalsform. Full
          specifikation visas innan teckning.
        </p>
      </aside>
    </section>
  );
}

function TrustBar() {
  return (
    <section aria-label="Fördelar med Gridex" className="border-y border-[var(--gx-border)]">
      <div className="grid divide-y divide-[var(--gx-border)] md:grid-cols-4 md:divide-x md:divide-y-0">
        <div className="py-5 md:pr-6">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gx-text-subtle)]">Pris</div>
          <div className="mt-2 text-sm font-semibold text-[var(--gx-text)]">Transparent prisbild</div>
          <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
            Se avgifter, påslag och avtalsform.
          </p>
        </div>

        <div className="py-5 md:px-6">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gx-text-subtle)]">Område</div>
          <div className="mt-2 text-sm font-semibold text-[var(--gx-text)]">SE1–SE4</div>
          <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
            Alternativ anpassade efter ditt elområde.
          </p>
        </div>

        <div className="py-5 md:px-6">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gx-text-subtle)]">Jämför</div>
          <div className="mt-2 text-sm font-semibold text-[var(--gx-text)]">Enkel överblick</div>
          <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
            Förstå skillnaden mellan avtalen snabbare.
          </p>
        </div>

        <div className="py-5 md:pl-6">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--gx-text-subtle)]">Teckna</div>
          <div className="mt-2 text-sm font-semibold text-[var(--gx-text)]">Tydlig väg vidare</div>
          <p className="mt-1 text-sm leading-6 text-[var(--gx-text-muted)]">
            Från jämförelse till teckning utan onödiga steg.
          </p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold text-white">Så fungerar det</h2>
        <p className="mt-3 text-gray-400">
          Vi har gjort det enklare att förstå elavtal. Jämför, räkna och välj
          det alternativ som passar dig bäst.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
            1
          </div>
          <div className="text-lg font-semibold text-white">
            Ange adress och postnummer
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Börja med att ange postnummer eller välj elområde manuellt.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
            2
          </div>
          <div className="text-lg font-semibold text-white">
            Jämför avtalsformer
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Välj mellan olika upplägg och se vad som passar din förbrukning.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-bold text-cyan-300">
            3
          </div>
          <div className="text-lg font-semibold text-white">
            Se priset och teckna
          </div>
          <p className="mt-2 text-sm text-gray-400">
            När du hittat rätt alternativ går du vidare och tecknar online.
          </p>
        </div>
      </div>
    </section>
  );
}

function ValueBlocks() {
  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.18em] text-cyan-300/80">
          Därför byter många
        </div>
        <h2 className="mt-3 text-3xl font-bold text-white">
          Många betalar mer än de behöver
        </h2>
        <p className="mt-4 max-w-2xl text-gray-400">
          Det är vanligt med elavtal som känns otydliga, där det är svårt att
          förstå vad man faktiskt betalar för. Gridex fokuserar på tydlighet,
          enkel jämförelse och bättre överblick redan från första sidan.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            Tydligare avgifter och villkor
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            Flera avtalsalternativ på samma plats
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
            Enklare väg från jämförelse till teckning
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gray-950 p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.18em] text-cyan-300/80">
          För dig som vill ha kontroll
        </div>
        <h2 className="mt-3 text-3xl font-bold text-white">
          Elavtal med tydlig prisrad
        </h2>
        <p className="mt-4 text-gray-400">
          Oavsett om du vill ha rörligt månadspris, portföljförvaltning eller
          fastpris ska det vara enkelt att förstå upplägget. Du ska se spotpris,
          påslag, rörliga avgifter, månadsavgift och moms innan du tecknar.
        </p>

        <div className="mt-8">
          <Link
            href="/elavtal"
            className="inline-flex rounded-xl bg-cyan-500 px-5 py-3 font-bold text-black transition hover:bg-cyan-400"
          >
            Jämför elavtal
          </Link>
        </div>
      </div>
    </section>
  );
}

function ArticleColumns() {
  const articles = [
    {
      title: "Så fungerar rörligt månadspris",
      text: "Rörligt månadspris bygger på föregående månads genomsnittliga spotpris i ditt elområde, plus avtalade avgifter och påslag.",
      href: "/elavtal/rorligt-elpris",
      cta: "Läs om rörligt",
    },
    {
      title: "Vad är elområde SE1–SE4?",
      text: "Sverige är indelat i fyra elområden. Ditt elområde påverkar spotpriset och därför även prisbilden för rörliga avtal.",
      href: "/guider/elomraden-se1-se2-se3-se4",
      cta: "Läs om elområden",
    },
    {
      title: "Så byter du elavtal",
      text: "Du väljer avtal, fyller i dina uppgifter och godkänner villkoren. Gridex AB hanterar uppstarten enligt ditt valda startdatum.",
      href: "/guider/byta-elbolag",
      cta: "Så fungerar bytet",
    },
    {
      title: "Vad ingår inte i elhandelspriset?",
      text: "Elnätsavgift, nätägarens fasta avgifter och eventuell effektavgift ingår normalt inte i elhandelspriset och faktureras av nätägaren.",
      href: "/guider/elnatsavgift-vs-elhandelspris",
      cta: "Läs om elnät",
    },
  ];

  return (
    <section className="space-y-6">
      <div className="max-w-3xl">
        <div className="text-sm uppercase tracking-[0.18em] text-cyan-300/80">
          Artiklar och guider
        </div>
        <h2 className="mt-3 text-3xl font-bold text-white">
          Förstå elpriset innan du väljer avtal
        </h2>
        <p className="mt-3 text-gray-400">
          Snabba guider i tydliga spalter för kunder som vill förstå pris,
          elområde, avtal och vad som faktiskt ingår.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {articles.map((article) => (
          <article
            key={article.title}
            className="flex min-h-[260px] flex-col justify-between rounded-3xl border border-white/10 bg-gray-950 p-6 transition hover:border-cyan-500/40"
          >
            <div>
              <h3 className="text-lg font-semibold text-white">
                {article.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {article.text}
              </p>
            </div>
            <Link
              href={article.href}
              className="mt-6 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              {article.cta} →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function HomeSeoBlocks() {
  return (
    <>
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-lg font-semibold text-white">
            Välj avtalet som passar dig
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Spot, portfölj eller fastpris – jämför alternativen enkelt och välj
            det som passar ditt hem bäst.
          </p>
          <Link
            href="/elavtal/jamfor-elavtal"
            className="mt-5 inline-block text-sm text-cyan-300 hover:text-cyan-200"
          >
            Läs mer →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-lg font-semibold text-white">Tydliga priser</div>
          <p className="mt-2 text-sm text-gray-400">
            Se hur priset är uppbyggt i ditt elområde och jämför avtalsformer
            utan otydliga villkor.
          </p>
          <Link
            href="/elpriser"
            className="mt-5 inline-block text-sm text-cyan-300 hover:text-cyan-200"
          >
            Se elpris per område →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gray-950 p-8">
          <div className="text-lg font-semibold text-white">Kundservice</div>
          <p className="mt-2 text-sm text-gray-400">
            Behöver du hjälp eller har frågor om ditt elavtal? Vi finns här för
            att hjälpa dig.
          </p>
          <Link
            href="/kundservice"
            className="mt-5 inline-block text-sm text-cyan-300 hover:text-cyan-200"
          >
            Kontakta oss →
          </Link>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white">
          Elpris per elområde (SE1–SE4)
        </h2>
        <p className="text-gray-400">
          Elpriset varierar mellan Sveriges elområden. Gridex visar elpris och
          avtalsalternativ på ett sätt som är enkelt att förstå, utan att dölja
          påslag eller avgifter.
        </p>

        <div className="grid gap-4 text-sm md:grid-cols-4">
          <Link
            href="/elpriser/se1"
            className="rounded-xl border border-white/10 p-4 transition hover:border-cyan-500/40"
          >
            Elpris SE1
          </Link>
          <Link
            href="/elpriser/se2"
            className="rounded-xl border border-white/10 p-4 transition hover:border-cyan-500/40"
          >
            Elpris SE2
          </Link>
          <Link
            href="/elpriser/se3"
            className="rounded-xl border border-white/10 p-4 transition hover:border-cyan-500/40"
          >
            Elpris SE3
          </Link>
          <Link
            href="/elpriser/se4"
            className="rounded-xl border border-white/10 p-4 transition hover:border-cyan-500/40"
          >
            Elpris SE4
          </Link>
        </div>
      </section>
    </>
  );
}


function HomeFaq({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-gray-950 p-6 md:p-8">
      <h2 className="text-2xl font-bold text-white">Vanliga frågor</h2>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <details key={item.question} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
              {item.question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-gray-300">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}