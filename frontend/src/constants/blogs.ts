export interface BlogPost {
  id: string;
  title: string;
  date: string;
  image: string;
  link: string;
}

export const blogPosts: BlogPost[] = [
  {
    id: "blog-1",
    title: "How to optimize event landing pages for higher ticket conversion",
    date: "22 Jun, 2026",
    image:
      "https://images.unsplash.com/photo-1515169067868-5387ec356754?q=80&w=1200&auto=format&fit=crop",
    link: "https://blog.ticketmaster.com/optimizing-event-pages-for-conversion/",
  },
  {
    id: "blog-2",
    title: "QR check-in operations checklist for high-capacity concerts",
    date: "05 Jul, 2026",
    image:
      "https://images.unsplash.com/photo-1505236858219-8359eb29e329?q=80&w=1200&auto=format&fit=crop",
    link: "https://www.eventbrite.com/blog/event-check-in-best-practices/",
  },
  {
    id: "blog-3",
    title: "Transparent pricing and frictionless checkout: impact on sales",
    date: "18 Aug, 2026",
    image:
      "https://images.unsplash.com/photo-1556741533-6e6a62bd8b49?q=80&w=1200&auto=format&fit=crop",
    link: "https://stripe.com/resources/more/checkout-ux-best-practices",
  },
];
