//app/(public)/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import ElectricityCalculator from "@/components/ElectricityCalculator";
import FaqJsonLd from "@/components/seo/FaqJsonLd";
import { fetchOpsPublicContracts } from "@/lib/ops/client";
import type { ContractOption } from "@/components/ElectricityCalculator";
import { faqByIds } from "@/lib/content/faq";
import { buildPublicContractDisplay } from "@/lib/website/publicContractDisplay";

export const dynamic = "force-dynamic";

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

  try {
    const visibleContracts = await fetchOpsPublicContracts();
    options = visibleContracts.filter((item) => buildPublicContractDisplay(item).ready).map((item) => ({
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
      portfolioPriceOrePerKwh: item.portfolio_price_ore_per_kwh ?? null,
      vatRate: item.vat_rate ?? null,
      pricingModel: item.pricing_model ?? null,
      spotShare: item.spot_share ?? null,
      portfolioShare: item.portfolio_share ?? null,
      customerTypes: item.customer_types ?? null,
    }));
  } catch {
    options = [];
  }

  const faqItems = faqByIds(['elomrade', 'vad-ingar', 'avtalsskillnad', 'behover']);

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-6 py-12 md:py-16">
      <FaqJsonLd items={faqItems} />

      <HeroBlock />
      <TrustBar />
      <ElectricityCalculator contracts={options} showCustomerTypeSelector persistCheckoutContext />
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
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-14">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[440px] w-[440px] rounded-full bg-cyan-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[360px] w-[360px] rounded-full bg-blue-500/10 blur-[130px]" />

      <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
            Gridex AB • Elhandelsbolag • SE1–SE4
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
              Elavtal utan dolda avgifter
              <br />
              se ditt pris innan du tecknar
            </h1>

            <p className="max-w-2xl text-lg leading-relaxed text-gray-300 md:text-xl">
              Gridex AB är ett svenskt elhandelsbolag som gör det enklare att
              förstå elpriset. Räkna på föregående månads spotpris, se påslag,
              avgifter och moms innan du går vidare till teckning.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="#rakna-elpris"
              className="rounded-xl bg-cyan-500 px-6 py-3 text-center font-bold text-black shadow-[0_0_40px_rgba(34,211,238,0.30)] transition hover:bg-cyan-400"
            >
              Räkna ditt elpris
            </Link>

            <Link
              href="/elavtal"
              className="rounded-xl border border-white/10 px-6 py-3 text-center text-gray-100 transition hover:border-cyan-500/40 hover:bg-white/5"
            >
              Se våra elavtal
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">
                Tydliga avgifter
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Du ser vad som ingår i priset innan du tecknar.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">
                Flera avtalsformer
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Spot, portfölj eller fastpris beroende på vad som passar dig.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">
                Anpassat per område
              </div>
              <div className="mt-1 text-sm text-gray-400">
                Jämför pris utifrån SE1, SE2, SE3 eller SE4.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-6 backdrop-blur-sm md:p-8">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-400">Varför Gridex?</div>
                <div className="text-2xl font-semibold text-white">
                  Enklare att förstå.
                  <br />
                  Enklare att välja rätt.
                </div>
              </div>

              <div className="shrink-0 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs text-green-300">
                Spotpris
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium text-white">
                  Slipp otydliga elavtal
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  Hos oss ser du villkor, avgifter och avtalsform utan gömda
                  överraskningar.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium text-white">
                  Jämför ditt pris direkt
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  Ange adress och postnummer så fastställs elområdet automatiskt.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-medium text-white">
                  Välj det som passar dig
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  Privatkunder och företag behöver olika upplägg. Därför visar vi flera
                  avtalsformer tydligt.
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="#rakna-elpris"
                className="block w-full rounded-xl bg-white py-3 text-center font-bold text-black transition hover:bg-gray-100"
              >
                Se ditt pris nu
              </Link>
            </div>

            <p className="text-xs leading-relaxed text-gray-500">
              Pris påverkas av elområde, förbrukning och vald avtalsform. Full
              specifikation visas innan teckning.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#0B0F17] p-4">
          <div className="text-sm font-semibold text-white">
            Transparent prisbild
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Se hur priset byggs upp med avgifter, påslag och avtalsform.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B0F17] p-4">
          <div className="text-sm font-semibold text-white">SE1–SE4</div>
          <p className="mt-1 text-sm text-gray-400">
            Priser och alternativ anpassade efter ditt elområde.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B0F17] p-4">
          <div className="text-sm font-semibold text-white">
            Enkel jämförelse
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Jämför avtalen snabbt och förstå skillnaden innan du väljer.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0B0F17] p-4">
          <div className="text-sm font-semibold text-white">Tydligare val</div>
          <p className="mt-1 text-sm text-gray-400">
            Mindre krångel, bättre överblick och enklare teckningsflöde.
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
