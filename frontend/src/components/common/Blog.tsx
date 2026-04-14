import { blogPosts } from "../../constants/blogs";
import { ArrowRight } from "lucide-react";

export default function Blog() {
  return (
    <section className="home-section" id="home-blog">
      <div className="section-heading">
        <div>
          <h2 className="home-blog-title">
            Our last <span className="home-blog-title-highlight">Blog</span>
          </h2>
        </div>
        <a href="#home-blog" className="section-link home-blog-link">
          <span>See All Posts</span>
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
                Read More
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}