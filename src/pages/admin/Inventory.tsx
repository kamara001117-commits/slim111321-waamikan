import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Product } from '@/src/types';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, Filter, Edit2, Trash2, X, Save, AlertCircle, Package, UploadCloud, FileText, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreUtils';
import Papa from 'papaparse';

import { logActivity } from '@/src/lib/activity';

const Inventory = () => {
  const { currentUserRole } = useOutletContext<{ currentUserRole: string | null }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isSeeding, setIsSeeding] = useState(false);

  const seedCatalog = async () => {
    setIsSeeding(true);
    const professionalProducts = [
      {
        name: "GE Healthcare Vscan Air™",
        category: "Imaging",
        description: "A wireless, handheld ultrasound system that enables quick, non-invasive imaging for cardiovascular, abdominal, and lung assessments.",
        price: 24500,
        stock: 15,
        sku: "GE-VSCAN-AIR",
        image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=800",
        specs: "Probe Type: Sector & Linear Dual-Probe; Frequency: 2-5MHz (Sector), 3-12MHz (Linear); Weight: 205g",
        updatedAt: new Date().toISOString()
      },
      {
        name: "Mindray BeneVision N12",
        category: "Equipment",
        description: "Patient monitor providing high-quality monitoring for adult, pediatric, and neonatal patients in critical care units.",
        price: 12800,
        stock: 8,
        sku: "MR-N12-MONITOR",
        image: "https://images.unsplash.com/photo-1576091160550-2173599211d0?auto=format&fit=crop&q=80&w=800",
        specs: "Display: 12\" HD Touch Screen; Parameters: ECG, SpO2, NIBP, Dual Temp, IBP; Battery: 4 hours",
        updatedAt: new Date().toISOString()
      },
      {
        name: "Hillrom Centrella® Smart+ Bed",
        category: "Furniture",
        description: "Advanced hospital bed designed for patient safety and comfort, featuring integrated weight measurement and fall prevention alarms.",
        price: 35000,
        stock: 5,
        sku: "HR-CENTRELLA-B",
        image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=800",
        specs: "Max Load: 227kg; Features: Advanced Patient Exit Alarm, Integrated Scale, USB-Port",
        updatedAt: new Date().toISOString()
      },
      {
        name: "Hamilton-C1 Ventilator",
        category: "Life Support",
        description: "Compact, high-end ventilator providing maximum comfort for patients with various respiratory needs.",
        price: 42000,
        stock: 4,
        sku: "HM-C1-VENT",
        image: "https://images.unsplash.com/photo-1631248055158-edec7a3c072b?auto=format&fit=crop&q=80&w=800",
        specs: "Mode: Invasive & Non-Invasive; Tidal Volume: 20-2000ml; Weight: 4.9kg",
        updatedAt: new Date().toISOString()
      },
      {
         name: "3M™ Littmann® Classic III™",
         category: "Consumables",
         description: "The 3M™ Littmann® Classic III™ Stethoscope is the latest version of the stethoscope that helps millions of medical professionals achieve their best.",
         price: 1200,
         stock: 50,
         sku: "3M-LIT-C3",
         image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=800",
         specs: "Chestpiece design: Precision-machined stainless steel; Diaphragm material: Epoxy/Glass fiber; Length: 69 cm",
         updatedAt: new Date().toISOString()
      }
    ];

    try {
      for (const product of professionalProducts) {
        await addDoc(collection(db, 'products'), product);
      }
      alert("Professional catalog seeded successfully!");
    } catch (error) {
      console.error("Error seeding catalog:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  // Import related state
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'progress' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const productFields = [
    { key: 'name', label: 'Product Name', required: true },
    { key: 'sku', label: 'SKU', required: true },
    { key: 'category', label: 'Category', required: true },
    { key: 'price', label: 'Price', required: true },
    { key: 'stock', label: 'Stock', required: true },
    { key: 'description', label: 'Description', required: false },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvData(results.data);
          setCsvHeaders(results.meta.fields || []);
          
          // Auto-map based on exact matches
          const initialMapping: Record<string, string> = {};
          productFields.forEach(field => {
            const match = results.meta.fields?.find(h => h.toLowerCase() === field.key.toLowerCase() || h.toLowerCase() === field.label.toLowerCase());
            if (match) initialMapping[field.key] = match;
          });
          setMapping(initialMapping);
          setImportStep('mapping');
        },
        error: (err) => {
          console.error("CSV Parse Error:", err);
          alert("Error parsing CSV file.");
        }
      });
    }
  };

  const executeImport = async () => {
    setImportStep('progress');
    setImportTotal(csvData.length);
    setImportProgress(0);
    setImportErrors([]);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      try {
        const payload: Partial<Product> = {
          name: row[mapping.name] || '',
          sku: row[mapping.sku] || '',
          category: (row[mapping.category] || 'Consumables') as Product['category'],
          price: parseFloat(row[mapping.price]) || 0,
          stock: parseInt(row[mapping.stock]) || 0,
          description: row[mapping.description] || '',
          updatedAt: new Date().toISOString()
        };

        if (!payload.name || !payload.sku) {
          throw new Error("Missing Name or SKU");
        }

        await addDoc(collection(db, 'products'), payload);
        successCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
      setImportProgress(i + 1);
    }

    setImportErrors(errors);
    setImportStep('complete');
    await logActivity('product', `Bulk imported ${successCount} products`, 'bulk', errors.length > 0 ? `Errors: ${errors.length}` : '');
  };

  const [formData, setFormData] = useState({
    name: '',
    category: 'Consumables' as Product['category'],
    description: '',
    price: 0,
    stock: 0,
    sku: '',
    image: '',
    specs: ''
  });

  useEffect(() => {
    if (!currentUserRole) return;

    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, [currentUserRole]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
        await logActivity('product', `Updated product ${formData.name}`, editingProduct.id, `Stock: ${formData.stock}`);
      } else {
        const docRef = await addDoc(collection(db, 'products'), payload);
        await logActivity('product', `Created product ${formData.name}`, docRef.id, `SKU: ${formData.sku}`);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', category: 'Consumables' as Product['category'], description: '', price: 0, stock: 0, sku: '', image: '', specs: '' });
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      const prod = products.find(p => p.id === id);
      await deleteDoc(doc(db, 'products', id));
      await logActivity('product', `Deleted product ${prod?.name}`, id, '');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex-grow max-w-md">
          <div className="flex items-center px-3 text-gray-400">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search products or SKU..."
            className="flex-grow p-2 outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-4">
          <select 
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option>All</option>
            <option>Consumables</option>
            <option>Imaging</option>
            <option>Equipment</option>
            <option>Furniture</option>
            <option>Life Support</option>
          </select>
          
          <button 
            onClick={seedCatalog}
            disabled={isSeeding}
            className="bg-green-50 text-green-700 border border-green-100 px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-100 transition-all shadow-sm disabled:opacity-50"
          >
            {isSeeding ? <Loader2 className="animate-spin" size={18} /> : <Package size={18} />}
            Seed Professional Catalog
          </button>

          <button 
            onClick={() => {
              setImportStep('upload');
              setIsImportModalOpen(true);
            }}
            className="bg-white text-[#0B3C5D] border border-gray-200 px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
          >
            <UploadCloud size={18} />
            Bulk Import
          </button>

          <button 
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="bg-[#0B3C5D] text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all shadow-sm"
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Product</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Price</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-[#0B3C5D] overflow-hidden border border-gray-100">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{product.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{product.sku}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${product.stock < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                    <span className="text-sm font-bold text-gray-700">{product.stock}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-[#0B3C5D]">GH₵ {product.price.toLocaleString()}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { 
                        setEditingProduct(product); 
                        setFormData({
                          name: product.name,
                          category: product.category,
                          description: product.description,
                          price: product.price,
                          stock: product.stock,
                          sku: product.sku,
                          image: product.image || '',
                          specs: product.specs || ''
                        }); 
                        setIsModalOpen(true); 
                      }}
                      className="p-2 text-gray-400 hover:text-[#0B3C5D] transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-full text-gray-300 mb-4">
              <Package size={32} />
            </div>
            <p className="text-gray-500">No products found. Start by adding one!</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-[#0B3C5D]">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Image Upload Area */}
                  <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <label className="text-xs font-bold text-gray-400 uppercase">Product Image</label>
                    <div 
                      className="aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 overflow-hidden relative group cursor-pointer hover:border-[#0B3C5D] transition-colors"
                      onClick={() => document.getElementById('image-upload')?.click()}
                    >
                      {formData.image ? (
                        <>
                          <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Plus className="text-white" size={32} />
                          </div>
                        </>
                      ) : (
                        <>
                          <Package size={48} className="text-gray-200" />
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Click to upload</p>
                        </>
                      )}
                      <input 
                        type="file" 
                        id="image-upload" 
                        hidden 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData({ ...formData, image: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                    {formData.image && (
                      <button 
                        type="button"
                        onClick={() => setFormData({ ...formData, image: '' })}
                        className="text-xs font-bold text-red-500 uppercase hover:text-red-700"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>

                  <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Product Name</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Category</label>
                      <select 
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                      >
                        <option>Consumables</option>
                        <option>Imaging</option>
                        <option>Equipment</option>
                        <option>Furniture</option>
                        <option>Life Support</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">SKU</label>
                      <input 
                        required
                        type="text" 
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Price (GH₵)</label>
                      <input 
                        required
                        type="number" 
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Initial Stock</label>
                      <input 
                        required
                        type="number" 
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                      <textarea 
                        rows={3}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Technical Specifications (Semicolon separated)</label>
                      <textarea 
                        rows={2}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#0B3C5D]"
                        value={formData.specs}
                        onChange={(e) => setFormData({...formData, specs: e.target.value})}
                        placeholder="Weight: 200g; Power: 220V; Material: Stainless Steel"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100 flex justify-end gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-[#0B3C5D] text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#1F7A8C] transition-all"
                  >
                    <Save size={18} />
                    {editingProduct ? 'Update Product' : 'Save Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => importStep !== 'progress' && setIsImportModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-[#0B3C5D]">Bulk Import Products</h3>
                  <p className="text-sm text-gray-400">Upload a CSV file to add multiple products</p>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                {importStep === 'upload' && (
                  <div className="space-y-6">
                    <div 
                      className="border-2 border-dashed border-gray-200 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 hover:border-[#0B3C5D] transition-colors cursor-pointer group"
                      onClick={() => document.getElementById('csv-upload')?.click()}
                    >
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0B3C5D] group-hover:scale-110 transition-transform">
                        <UploadCloud size={32} />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-gray-700">Click to upload CSV</p>
                        <p className="text-xs text-gray-400">or drag and drop your file here</p>
                      </div>
                      <input 
                        type="file" 
                        id="csv-upload" 
                        hidden 
                        accept=".csv"
                        onChange={handleFileUpload}
                      />
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                      <AlertCircle className="text-amber-600 shrink-0" size={20} />
                      <div className="text-xs text-amber-800 space-y-1">
                        <p className="font-bold uppercase tracking-wider">Format Requirements</p>
                        <p>Your CSV should include columns for: Name, SKU, Category, Price, and Stock.</p>
                      </div>
                    </div>
                  </div>
                )}

                {importStep === 'mapping' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {productFields.map(field => (
                        <div key={field.key} className="space-y-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <select 
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0B3C5D]"
                            value={mapping[field.key] || ''}
                            onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                          >
                            <option value="">Select column...</option>
                            {csvHeaders.map(header => (
                              <option key={header} value={header}>{header}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 flex justify-between gap-4">
                      <button 
                        onClick={() => setImportStep('upload')}
                        className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-100"
                      >
                        Back
                      </button>
                      <button 
                        onClick={executeImport}
                        disabled={productFields.filter(f => f.required).some(f => !mapping[f.key])}
                        className="flex-grow bg-[#0B3C5D] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#1F7A8C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Start Import ({csvData.length} items)
                      </button>
                    </div>
                  </div>
                )}

                {importStep === 'progress' && (
                  <div className="py-12 space-y-8 text-center">
                    <div className="relative inline-flex items-center justify-center">
                      <Loader2 className="text-[#0B3C5D] animate-spin" size={64} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-black text-[#0B3C5D]">
                          {Math.round((importProgress / importTotal) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-bold text-gray-700">Importing Data...</h4>
                      <p className="text-sm text-gray-400">Please do not close this window</p>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden max-w-sm mx-auto">
                        <motion.div 
                          className="h-full bg-[#0B3C5D]"
                          initial={{ width: 0 }}
                          animate={{ width: `${(importProgress / importTotal) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs font-mono text-gray-400">{importProgress} of {importTotal} processed</p>
                    </div>
                  </div>
                )}

                {importStep === 'complete' && (
                  <div className="py-8 space-y-8">
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto">
                        <Check size={40} />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-gray-800">Import Complete!</h4>
                        <p className="text-gray-400">Successfully imported {importTotal - importErrors.length} products</p>
                      </div>
                    </div>

                    {importErrors.length > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl overflow-hidden">
                        <div className="px-4 py-2 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-widest flex justify-between">
                          <span>Errors ({importErrors.length})</span>
                        </div>
                        <div className="p-4 max-h-40 overflow-y-auto space-y-1">
                          {importErrors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600 flex gap-2">
                              <span className="font-bold shrink-0">•</span> {err}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <button 
                        onClick={() => setIsImportModalOpen(false)}
                        className="bg-[#0B3C5D] text-white px-12 py-3 rounded-xl font-bold hover:bg-[#1F7A8C] transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
