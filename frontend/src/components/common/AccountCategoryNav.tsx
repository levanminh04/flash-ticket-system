import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { categoryService } from "../../services/categoryService";
import { Category } from "../../types/api";

export default function AccountCategoryNav() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await categoryService.getCategories();
        if (!cancelled) {
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className="category-nav">
      <div className="container">
        <ul className="category-list">
          <li className="category-item">
            <Link to="/search" className="category-link">
              Tất cả
            </Link>
          </li>
          {categories.map((category) => (
            <li className="category-item" key={category.id}>
              <Link
                to={`/search?category=${category.slug || category.id}`}
                className="category-link"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
