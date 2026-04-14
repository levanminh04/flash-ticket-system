import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { categoryService } from "../../services/categoryService";
import { Category } from "../../types/api";

type AccountCategoryNavItem = {
  label: string;
  to: string;
  isHash?: boolean;
};

type AccountCategoryNavProps = {
  items?: AccountCategoryNavItem[];
};

export default function AccountCategoryNav({
  items,
}: AccountCategoryNavProps = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const shouldUseCustomItems = Array.isArray(items) && items.length > 0;

  useEffect(() => {
    if (shouldUseCustomItems) {
      setCategories([]);
      return;
    }

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
  }, [shouldUseCustomItems]);

  return (
    <nav
      className={`category-nav account-category-nav ${
        shouldUseCustomItems ? "account-category-nav--custom" : ""
      }`}
    >
      <div className="container account-category-nav-inner">
        <ul className="category-list account-category-list">
          {shouldUseCustomItems
            ? items.map((item) => (
                <li className="category-item" key={`${item.label}-${item.to}`}>
                  {item.isHash ? (
                    <a href={item.to} className="category-link">
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.to} className="category-link">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))
            : (
                <>
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
                </>
              )}
        </ul>
      </div>
    </nav>
  );
}
