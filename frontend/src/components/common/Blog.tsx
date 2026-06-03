import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { blogPosts } from "../../constants/blogs";

type BlogProps = {
  highlight?: string;
  title?: string;
};

function renderTitleWithHighlight(title: string, highlight: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedHighlight = highlight.toLowerCase();
  const highlightIndex = normalizedTitle.lastIndexOf(normalizedHighlight);

  if (highlightIndex < 0) return title;

  return (
    <>
      {title.slice(0, highlightIndex)}
      <span className="home-blog-title-highlight">
        {title.slice(highlightIndex, highlightIndex + highlight.length)}
      </span>
      {title.slice(highlightIndex + highlight.length)}
    </>
  );
}

export default function Blog({ highlight, title }: BlogProps) {
  const { t } = useTranslation();
  const resolvedTitle = title || `${t("blog.titleFirst")} ${t("blog.titleHighlight")}`;
  const resolvedHighlight = highlight || t("blog.titleHighlight");

  return (
    <section className="home-section" id="home-blog">
      <div className="section-heading">
        <div>
          <h2 className="home-blog-title">
            {renderTitleWithHighlight(resolvedTitle, resolvedHighlight)}
          </h2>
        </div>
        <a href="#home-blog" className="section-link home-blog-link">
          <span>{t("blog.seeAllPosts")}</span>
          <span className="home-blog-link-icon" aria-hidden="true">
            <ArrowRight size={16} />
          </span>
        </a>
      </div>

      <div className="blog-grid">
        {blogPosts.map((post) => (
          <article className="blog-card" key={post.id}>
            <a href={post.link} target="_blank" rel="noreferrer">
              <img src={post.image} alt={post.title} />
            </a>
            <div className="blog-card-body">
              <span>{post.date}</span>
              <h3>
                <a
                  href={post.link}
                  target="_blank"
                  rel="noreferrer"
                  className="blog-post-title-link"
                >
                  {post.title}
                </a>
              </h3>
              <a href={post.link} target="_blank" rel="noreferrer">
                {t("blog.readMore")}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
