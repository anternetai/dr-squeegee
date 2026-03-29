export function FAQSchema() {
  const faqs = [
    {
      question: "How much does pressure washing cost in Charlotte?",
      answer: "Pricing depends on the size of the surface and type of cleaning needed. House washing typically ranges from $200-$500, driveway cleaning from $100-$250. Contact us for a free, no-obligation quote.",
    },
    {
      question: "How often should I pressure wash my house?",
      answer: "Most homes in the Charlotte area benefit from annual pressure washing. Homes with heavy tree coverage or north-facing walls may need cleaning every 6-9 months to prevent mold and mildew buildup.",
    },
    {
      question: "Do you use soft wash or high pressure?",
      answer: "We use both methods depending on the surface. Soft wash (low pressure with cleaning solution) is used for siding, stucco, and delicate surfaces. High-pressure cleaning is used for concrete driveways, sidewalks, and patios.",
    },
    {
      question: "Are you licensed and insured?",
      answer: "Yes. Dr. Squeegee is fully licensed and insured with general liability coverage. Your property is protected on every job.",
    },
    {
      question: "What areas of Charlotte do you serve?",
      answer: "We serve Charlotte and the surrounding areas including Huntersville, Cornelius, Matthews, Mint Hill, Indian Trail, Pineville, Ballantyne, South End, NoDa, Plaza Midwood, Dilworth, Myers Park, and the greater Mecklenburg County area.",
    },
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map((faq) => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer,
            },
          })),
        }),
      }}
    />
  )
}

export const FAQ_DATA = [
  {
    question: "How much does pressure washing cost in Charlotte?",
    answer: "Pricing depends on the size of the surface and type of cleaning needed. House washing typically ranges from $200-$500, driveway cleaning from $100-$250. Contact us for a free, no-obligation quote.",
  },
  {
    question: "How often should I pressure wash my house?",
    answer: "Most homes in the Charlotte area benefit from annual pressure washing. Homes with heavy tree coverage or north-facing walls may need cleaning every 6-9 months to prevent mold and mildew buildup.",
  },
  {
    question: "Do you use soft wash or high pressure?",
    answer: "We use both methods depending on the surface. Soft wash (low pressure with cleaning solution) is used for siding, stucco, and delicate surfaces. High-pressure cleaning is used for concrete driveways, sidewalks, and patios.",
  },
  {
    question: "Are you licensed and insured?",
    answer: "Yes. Dr. Squeegee is fully licensed and insured with general liability coverage. Your property is protected on every job.",
  },
  {
    question: "What areas of Charlotte do you serve?",
    answer: "We serve Charlotte and the surrounding areas including Huntersville, Cornelius, Matthews, Mint Hill, Indian Trail, Pineville, Ballantyne, South End, NoDa, Plaza Midwood, Dilworth, Myers Park, and the greater Mecklenburg County area.",
  },
]
