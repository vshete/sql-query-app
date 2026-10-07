-- Run against a dedicated demo database. Re-running preserves existing rows.
CREATE TABLE IF NOT EXISTS public.categories (
  category_id integer PRIMARY KEY,
  category_name varchar(100) NOT NULL,
  description text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.employees (
  employee_id integer PRIMARY KEY,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  title varchar(100) NOT NULL,
  country varchar(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS public.customers (
  customer_id varchar(20) PRIMARY KEY,
  company_name varchar(200) NOT NULL,
  contact_name varchar(100) NOT NULL,
  city varchar(100) NOT NULL,
  country varchar(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS public.products (
  product_id integer PRIMARY KEY,
  product_name varchar(200) NOT NULL,
  category_id integer NOT NULL REFERENCES public.categories(category_id),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  units_in_stock integer NOT NULL CHECK (units_in_stock >= 0),
  discontinued boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.orders (
  order_id integer PRIMARY KEY,
  customer_id varchar(20) NOT NULL REFERENCES public.customers(customer_id),
  employee_id integer NOT NULL REFERENCES public.employees(employee_id),
  order_date date NOT NULL,
  shipped_date date,
  freight numeric(10,2) NOT NULL CHECK (freight >= 0),
  CHECK (shipped_date IS NULL OR shipped_date >= order_date)
);
CREATE TABLE IF NOT EXISTS public.order_details (
  order_id integer NOT NULL REFERENCES public.orders(order_id),
  product_id integer NOT NULL REFERENCES public.products(product_id),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  discount numeric(4,2) NOT NULL CHECK (discount BETWEEN 0 AND 1),
  PRIMARY KEY (order_id, product_id)
);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_employee_id_idx ON public.orders(employee_id);
CREATE INDEX IF NOT EXISTS orders_order_date_idx ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS order_details_product_id_idx ON public.order_details(product_id);

INSERT INTO public.categories
SELECT i, (ARRAY['Beverages','Condiments','Confections','Dairy','Grains','Meat','Produce','Seafood'])[i],
  'Sample sales category ' || i
FROM generate_series(1,8) AS s(i)
ON CONFLICT DO NOTHING;

INSERT INTO public.employees
SELECT i, (ARRAY['Asha','James','Maria','Liam','Sofia'])[1 + (i-1)%5], 'Salesperson ' || i,
  CASE WHEN i%6=0 THEN 'Sales Manager' ELSE 'Sales Representative' END,
  (ARRAY['India','USA','Germany','UK','Brazil'])[1 + (i-1)%5]
FROM generate_series(1,30) AS s(i)
ON CONFLICT DO NOTHING;

INSERT INTO public.customers
SELECT 'C' || lpad(i::text,5,'0'), 'Company ' || i, 'Contact ' || i,
  (ARRAY['Mumbai','New York','Berlin','London','Sao Paulo'])[1 + (i-1)%5],
  (ARRAY['India','USA','Germany','UK','Brazil'])[1 + (i-1)%5]
FROM generate_series(1,150) AS s(i)
ON CONFLICT DO NOTHING;

INSERT INTO public.products
SELECT i, (ARRAY['Tea','Sauce','Chocolate','Cheese','Rice','Chicken','Apples','Salmon'])[1 + (i-1)%8] || ' ' || i,
  1 + (i-1)%8, (500 + (i*137)%19500)::numeric/100, (i*17)%300, i%13=0
FROM generate_series(1,100) AS s(i)
ON CONFLICT DO NOTHING;

INSERT INTO public.orders
SELECT 10000+i, 'C' || lpad((1 + (i-1)%150)::text,5,'0'), 1 + (i-1)%30,
  DATE '2024-01-01' + (i-1)%1000,
  CASE WHEN i%10=0 THEN NULL ELSE DATE '2024-01-01' + (i-1)%1000 + 1 + i%7 END,
  (500 + (i*73)%14500)::numeric/100
FROM generate_series(1,1000) AS s(i)
ON CONFLICT DO NOTHING;

INSERT INTO public.order_details
SELECT 10000+i, p.product_id, p.unit_price, 1 + (i*j)%25,
  (ARRAY[0.00,0.05,0.10,0.15,0.20]::numeric[])[1 + (i+j)%5]
FROM generate_series(1,1000) AS s(i)
CROSS JOIN generate_series(1,3) AS d(j)
JOIN public.products p ON p.product_id = 1 + ((i-1)*7 + j-1)%100
ON CONFLICT DO NOTHING;
