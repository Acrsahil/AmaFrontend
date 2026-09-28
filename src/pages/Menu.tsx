import { useState, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { fetchPublicMenu } from "@/api";
import { LOGO_PATH } from "@/config/constants";

interface Product {
  id: number;
  name: string;
  price?: string;
  selling_price?: string;
  category: number;
  category_name?: string;
  image_url?: string;
  description?: string;
  is_available?: boolean;
}

interface Category {
  id: number;
  name: string;
  supercategory_name?: string;
}

export default function Menu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    setLoading(true);
    try {
      const menuData = await fetchPublicMenu();
      
      console.log("🍽️ Public Menu API Response:", menuData);
      console.log("📦 Products:", menuData.products);
      console.log("📁 Categories:", menuData.categories);
      
      const productsArray = Array.isArray(menuData.products) ? menuData.products : [];
      const categoriesArray = Array.isArray(menuData.categories) ? menuData.categories : [];

      console.log("✅ Products Count:", productsArray.length);
      console.log("✅ Categories Count:", categoriesArray.length);
      
      if (productsArray.length > 0) {
        console.log("🔍 Sample Product:", productsArray[0]);
      }

      setProducts(productsArray);
      setCategories(categoriesArray);
    } catch (error) {
      console.error("❌ Failed to load menu:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort products based on search and category
  const filteredProducts = products
    .filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-medium">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8E7] via-white to-[#FFF8E7]">
      {/* Header - Non-sticky part that scrolls away */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-[#d19d2a]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 space-y-4">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-[#d19d2a] to-[#b8862a] flex items-center justify-center p-1.5">
                <img 
                  src={LOGO_PATH} 
                  alt="AMA Bakery" 
                  className="h-full w-full object-contain" 
                />
              </div>
            </div>
            
            {/* Title */}
            <div className="text-center">
              <h1 className="text-5xl sm:text-6xl font-rockwell font-bold text-[#78570A] tracking-tight uppercase">
                Menu
              </h1>
              <p className="mt-3 text-base sm:text-lg text-[#A17C2F] font-medium">
                Discover our delicious offerings
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Search Bar and Category Filters */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[#d19d2a]/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#d19d2a]/60 group-focus-within:text-[#d19d2a] transition-colors" />
              <input
                type="text"
                placeholder="Search for dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-11 pr-11 rounded-xl border-2 border-[#d19d2a]/20 bg-white font-medium text-sm text-[#78570A] placeholder:text-[#d19d2a]/40 focus:outline-none focus:border-[#d19d2a] focus:ring-2 focus:ring-[#d19d2a]/10 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-[#FFF8E7] hover:bg-[#d19d2a]/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3 text-[#78570A]" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-2 min-w-min justify-center">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-5 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                  !selectedCategory
                    ? "bg-gradient-to-r from-[#d19d2a] to-[#b8862a] text-white shadow-lg shadow-[#d19d2a]/30"
                    : "bg-white text-[#78570A] border-2 border-[#d19d2a]/30 hover:border-[#d19d2a] hover:bg-[#FFF8E7]"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-5 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                    selectedCategory === cat.id
                      ? "bg-gradient-to-r from-[#d19d2a] to-[#b8862a] text-white shadow-lg shadow-[#d19d2a]/30"
                      : "bg-white text-[#78570A] border-2 border-[#d19d2a]/30 hover:border-[#d19d2a] hover:bg-[#FFF8E7]"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex h-20 w-20 rounded-full bg-[#FFF8E7] border-2 border-[#d19d2a]/30 items-center justify-center mb-4">
              <Search className="h-10 w-10 text-[#d19d2a]/60" />
            </div>
            <h3 className="text-2xl font-bold text-[#78570A] mb-2">No items found</h3>
            <p className="text-[#A17C2F]">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {filteredProducts.map((product) => {
              const isExpanded = expandedProductId === product.id;
              return (
                <div
                  key={product.id}
                  onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                  className={`group bg-white rounded-3xl overflow-hidden border-2 transition-all duration-500 flex flex-col cursor-pointer ${
                    isExpanded 
                      ? "border-[#d19d2a] shadow-2xl shadow-[#d19d2a]/40 z-50" 
                      : "border-[#d19d2a]/20 hover:border-[#d19d2a] hover:shadow-2xl hover:shadow-[#d19d2a]/20 hover:-translate-y-1"
                  }`}
                >
                  {/* Product Image - 70% with 4:3 ratio */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-[#FFF8E7] to-[#FFF0D1] relative overflow-hidden flex-[0.7]">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white shadow-lg shadow-[#d19d2a]/20 mx-auto flex items-center justify-center border-2 border-[#d19d2a]/30">
                            <span className="text-2xl sm:text-3xl font-black text-[#d19d2a]">
                              {product.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {product.is_available === false && (
                      <div className="absolute inset-0 bg-[#78570A]/70 backdrop-blur-sm flex items-center justify-center">
                        <span className="px-3 py-1.5 bg-white rounded-full text-xs sm:text-sm font-bold text-[#78570A]">
                          Unavailable
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Info - 30% */}
                  <div className="p-3 sm:p-4 space-y-1 sm:space-y-2 flex-[0.3] flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-[#78570A] line-clamp-1 group-hover:text-[#d19d2a] transition-colors">
                        {product.name}
                      </h3>
                      {product.category_name && (
                        <p className="text-[10px] sm:text-xs font-bold text-[#d19d2a]/60 uppercase tracking-wider">
                          {product.category_name}
                        </p>
                      )}
                    </div>

                    <div className="text-lg sm:text-xl font-black text-[#d19d2a]">
                      Rs. {(() => {
                        const priceValue = product.selling_price || product.price || '0';
                        const numPrice = typeof priceValue === 'number' 
                          ? priceValue 
                          : parseFloat(priceValue) || 0;
                        return numPrice.toFixed(2);
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-xl mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-slate-600 font-medium">
            Prices are subject to change. Please contact us for the latest information.
          </p>
        </div>
      </footer>
    </div>
  );
}
