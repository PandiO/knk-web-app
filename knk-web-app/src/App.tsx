import * as React from 'react';
import { ItemsTable } from './components/ItemsTable';
import { DataTable } from './components/DataTable';
import { ItemDTO } from './utils/domain/itemModels';

// Sample data for Items
const sampleItems: ItemDTO[] = [
  {
    Id: 1,
    Name: "laptop-pro",
    DisplayName: "Laptop Pro",
    CategoryId: 1,
    CategoryName: "Electronics",
    BaseItemName: "Laptop",
    BasePrice: 999.99,
    GradeId: 1,
    ItemtypeId: 1
  },
  {
    Id: 2,
    Name: "wireless-mouse",
    DisplayName: "Wireless Mouse",
    CategoryId: 1,
    CategoryName: "Electronics",
    BaseItemName: "Mouse",
    BasePrice: 29.99,
    GradeId: 1,
    ItemtypeId: 1
  }
];

// Sample data for a different type of object
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  lastLogin: Date;
  role: string;
}

const sampleUsers: User[] = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    isActive: true,
    lastLogin: new Date("2024-03-10"),
    role: "Admin"
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    isActive: false,
    lastLogin: new Date("2024-03-08"),
    role: "User"
  }
];

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Original Items Table</h1>
          <ItemsTable items={sampleItems} />
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Generic Table - Items</h2>
          <DataTable
            data={sampleItems}
            formatters={{
              CategoryName: (value) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {value}
                </span>
              ),
              BasePrice: (value) => `$${value.toFixed(2)}`,
            }}
            headers={{
              Id: "ID",
              CategoryId: "Category ID",
              BasePrice: "Base Price",
            }}
          />
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Generic Table - Users</h2>
          <DataTable
            data={sampleUsers}
            formatters={{
              isActive: (value) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {value ? 'Active' : 'Inactive'}
                </span>
              ),
              lastLogin: (value) => new Date(value).toLocaleDateString(),
              role: (value) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {value}
                </span>
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;