import { useState } from 'react';
import { Card, Badge, Button, Input, Modal } from '@/components/ui';
import { Search, Filter, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIOCs, useCreateIOC, useDeleteIOC } from '@/api/hooks';

const IOC_TYPES = ['IP', 'DOMAIN', 'URL', 'HASH_MD5', 'HASH_SHA1', 'HASH_SHA256', 'EMAIL', 'CIDR', 'REGISTRY_KEY', 'MUTEX'] as const;

export function IOCsPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const { data, isLoading, error } = useIOCs({
    page,
    limit: 20,
    search: search || undefined,
    type: typeFilter || undefined,
    isActive: activeFilter === '' ? undefined : activeFilter === 'true',
  });

  const createIOC = useCreateIOC();
  const deleteIOC = useDeleteIOC();

  const [formData, setFormData] = useState({
    type: 'IP' as typeof IOC_TYPES[0],
    value: '',
    confidence: 0.8,
    source: '',
    tags: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createIOC.mutate({
      type: formData.type,
      value: formData.value,
      confidence: formData.confidence,
      source: formData.source || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      description: formData.description || undefined,
    });
    setShowModal(false);
    setFormData({ type: 'IP', value: '', confidence: 0.8, source: '', tags: '', description: '' });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this IOC?')) {
      deleteIOC.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card padding="none" className="animate-pulse">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4" />
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-red-600">Failed to load IOCs</p>
      </Card>
    );
  }

  const total = data?.meta.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Feeds & sightings · {total} indicators</p>
          <h1 className="page-title font-display">Threat Intelligence</h1>
          <p className="page-subtitle">Manage indicators of compromise</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add IOC
        </Button>
      </div>

      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input placeholder="Search IOCs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Types</option>
              {IOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <Button variant="secondary" className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {data?.data.map((ioc) => (
                <tr key={ioc.id} className="threat-row" data-sev={ioc.isActive ? 'high' : 'info'}>
                  <td className="px-4 py-3"><Badge variant="info">{ioc.type}</Badge></td>
                  <td className="px-4 py-3"><code className="text-sm font-mono text-gray-900 dark:text-gray-100">{ioc.value}</code></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs">
                        <div className="h-full bg-primary-600" style={{ width: `${ioc.confidence * 100}%` }} />
                      </div>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-10">{(ioc.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{ioc.source || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {ioc.tags.map((tag) => (
                        <Badge key={tag} variant="info" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ioc.isActive ? 'success' : 'info'}>
                      {ioc.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDelete(ioc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} results
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {data?.meta.totalPages || 1}</span>
            <Button variant="ghost" size="sm" disabled={page >= (data?.meta.totalPages || 1)} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add IOC" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="input"
              >
                {IOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input
              label="Confidence"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={formData.confidence}
              onChange={(e) => setFormData({ ...formData, confidence: parseFloat(e.target.value) })}
            />
          </div>
          <Input
            label="Value"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            placeholder="e.g., 192.168.1.1 or malicious-domain.com"
            required
          />
          <Input
            label="Source"
            value={formData.source}
            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            placeholder="e.g., Threat Feed Alpha"
          />
          <Input
            label="Tags (comma separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="malware, c2, apt29"
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Additional context..."
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" disabled={createIOC.isPending}>Add IOC</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}