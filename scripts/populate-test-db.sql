-- Fictional banking demo. Fixed snapshot: 2026-10-01; all amounts are INR.
-- Reseeding replaces only the banking_demo schema, including its data.
DROP SCHEMA IF EXISTS banking_demo CASCADE;
CREATE SCHEMA banking_demo;
SET search_path TO banking_demo;

CREATE TABLE branches (
    branch_id INTEGER PRIMARY KEY,
    branch_name TEXT NOT NULL,
    city TEXT NOT NULL
);
CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    annual_income NUMERIC(12,2) NOT NULL CHECK (annual_income >= 0),
    credit_score INTEGER NOT NULL CHECK (credit_score BETWEEN 300 AND 900),
    joined_on DATE NOT NULL
);
CREATE TABLE loans (
    loan_id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers,
    loan_type TEXT NOT NULL CHECK (loan_type IN ('Home','Personal','Auto','Education')),
    issued_on DATE NOT NULL,
    principal_amount NUMERIC(12,2) NOT NULL CHECK (principal_amount > 0),
    outstanding_amount NUMERIC(12,2) NOT NULL CHECK (outstanding_amount BETWEEN 0 AND principal_amount),
    annual_interest_rate NUMERIC(5,2) NOT NULL CHECK (annual_interest_rate > 0),
    term_months INTEGER NOT NULL CHECK (term_months > 0),
    status TEXT NOT NULL CHECK (status IN ('Active','Closed','Defaulted'))
);
CREATE TABLE loan_installments (
    installment_id INTEGER PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans,
    due_on DATE NOT NULL,
    amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due > 0),
    amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid BETWEEN 0 AND amount_due),
    paid_on DATE,
    UNIQUE (loan_id, due_on),
    CHECK ((amount_paid = 0 AND paid_on IS NULL) OR (amount_paid > 0 AND paid_on IS NOT NULL))
);
CREATE TABLE credit_cards (
    card_id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers,
    card_last_four CHAR(4) NOT NULL,
    card_tier TEXT NOT NULL CHECK (card_tier IN ('Classic','Gold','Platinum')),
    issued_on DATE NOT NULL,
    credit_limit NUMERIC(12,2) NOT NULL CHECK (credit_limit > 0),
    status TEXT NOT NULL CHECK (status IN ('Active','Blocked'))
);
CREATE TABLE merchants (
    merchant_id INTEGER PRIMARY KEY,
    merchant_name TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL
);
CREATE TABLE credit_card_sales (
    sale_id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards,
    merchant_id INTEGER NOT NULL REFERENCES merchants,
    sold_at TIMESTAMP NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL CHECK (status IN ('Settled','Refunded','Declined'))
);
CREATE TABLE credit_card_statements (
    statement_id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES credit_cards,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_on DATE NOT NULL,
    statement_amount NUMERIC(12,2) NOT NULL CHECK (statement_amount > 0),
    minimum_due NUMERIC(12,2) NOT NULL CHECK (minimum_due BETWEEN 0 AND statement_amount),
    amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid BETWEEN 0 AND statement_amount),
    paid_on DATE,
    UNIQUE (card_id, period_start),
    CHECK (period_start <= period_end AND period_end < due_on),
    CHECK ((amount_paid = 0 AND paid_on IS NULL) OR (amount_paid > 0 AND paid_on IS NOT NULL))
);

INSERT INTO branches VALUES
(1,'Central Mumbai','Mumbai'), (2,'Koramangala','Bengaluru'),
(3,'Connaught Place','Delhi'), (4,'T Nagar','Chennai'), (5,'Hinjewadi','Pune');

INSERT INTO customers
SELECT i, 1 + (i-1)%5,
       (ARRAY['Aarav','Diya','Kabir','Meera','Rohan','Ananya','Ishaan','Kavya'])[1+(i-1)%8]
       || ' Demo ' || i,
       'customer' || i || '@banking.example',
       300000 + (i*7919)%2200000, 350 + (i*17)%501,
       DATE '2023-01-01' + (i*7)%730
FROM generate_series(1,200) AS i;

INSERT INTO loans
SELECT i, 1+(i-1)%200,
       (ARRAY['Home','Personal','Auto','Education'])[1+(i-1)%4],
       DATE '2025-01-01' + (i*3)%180,
       100000 + (i%20)*50000,
       CASE WHEN i%10=0 THEN 0 ELSE (100000+(i%20)*50000)*0.75 END,
       (ARRAY[8.5,14.0,9.5,10.5])[1+(i-1)%4],
       (ARRAY[120,36,60,48])[1+(i-1)%4],
       CASE WHEN i%10=0 THEN 'Closed' WHEN i%7=0 THEN 'Defaulted' ELSE 'Active' END
FROM generate_series(1,240) AS i;

-- Six observed installments per loan; defaults miss July through September.
INSERT INTO loan_installments
SELECT (l.loan_id-1)*6+m, l.loan_id,
       (DATE '2026-04-01' + (m-1)*INTERVAL '1 month')::date,
       round(l.principal_amount/l.term_months + l.principal_amount*l.annual_interest_rate/1200,2),
       CASE WHEN l.status='Defaulted' AND m>=4 THEN 0
            ELSE round(l.principal_amount/l.term_months + l.principal_amount*l.annual_interest_rate/1200,2) END,
       CASE WHEN l.status='Defaulted' AND m>=4 THEN NULL
            ELSE (DATE '2026-04-01' + (m-1)*INTERVAL '1 month' + INTERVAL '2 days')::date END
FROM loans l CROSS JOIN generate_series(1,6) AS m;

INSERT INTO credit_cards
SELECT i, 1+(i-1)%180, lpad(i::text,4,'0'),
       (ARRAY['Classic','Gold','Platinum'])[1+(i-1)%3],
       DATE '2025-07-01' + i%150, 50000+(i%10)*25000,
       CASE WHEN i%9=0 THEN 'Blocked' ELSE 'Active' END
FROM generate_series(1,220) AS i;

INSERT INTO merchants
SELECT i, 'Demo Merchant ' || i,
       (ARRAY['Groceries','Travel','Dining','Electronics','Healthcare'])[1+(i-1)%5],
       (ARRAY['Mumbai','Bengaluru','Delhi','Chennai','Pune'])[1+(i-1)%5]
FROM generate_series(1,25) AS i;

-- Exactly ten transactions per card in each of July and August.
INSERT INTO credit_card_sales
SELECT (c.card_id-1)*20 + (m-1)*10+n, c.card_id,
       1+(c.card_id+n-2)%25,
       TIMESTAMP '2026-07-01 10:00:00' + (m-1)*INTERVAL '1 month' + (n-1)*INTERVAL '2 days',
       200 + (c.card_id*37+n*113)%4800,
       CASE WHEN n=10 THEN 'Declined' WHEN n=9 THEN 'Refunded' ELSE 'Settled' END
FROM credit_cards c CROSS JOIN generate_series(1,2) AS m CROSS JOIN generate_series(1,10) AS n;

-- Statements sum settled purchases only; blocked cards miss both payments.
INSERT INTO credit_card_statements
SELECT (c.card_id-1)*2+m, c.card_id,
       (DATE '2026-07-01' + (m-1)*INTERVAL '1 month')::date,
       (DATE '2026-07-01' + m*INTERVAL '1 month' - INTERVAL '1 day')::date,
       (DATE '2026-07-15' + m*INTERVAL '1 month')::date,
       totals.amount, round(totals.amount*0.05,2),
       CASE WHEN c.status='Blocked' THEN 0 WHEN c.card_id%5=0 THEN round(totals.amount*0.1,2) ELSE totals.amount END,
       CASE WHEN c.status='Blocked' THEN NULL ELSE (DATE '2026-07-12' + m*INTERVAL '1 month')::date END
FROM credit_cards c CROSS JOIN generate_series(1,2) AS m
CROSS JOIN LATERAL (
    SELECT sum(s.amount) AS amount FROM credit_card_sales s
    WHERE s.card_id=c.card_id AND s.status='Settled'
      AND s.sold_at >= DATE '2026-07-01' + (m-1)*INTERVAL '1 month'
      AND s.sold_at < DATE '2026-07-01' + m*INTERVAL '1 month'
) totals;

-- Derived defaulters avoid a second, inconsistent copy of payment data.
CREATE VIEW defaulters AS
SELECT l.customer_id, 'Loan'::text AS credit_product, l.loan_id AS account_id,
       min(i.due_on) AS oldest_unpaid_due_on,
       DATE '2026-10-01' - min(i.due_on) AS days_past_due,
       sum(i.amount_due-i.amount_paid) AS overdue_amount
FROM loans l JOIN loan_installments i USING (loan_id)
WHERE i.due_on < DATE '2026-10-01' AND i.amount_paid < i.amount_due
GROUP BY l.customer_id,l.loan_id
UNION ALL
SELECT c.customer_id, 'Credit Card', c.card_id, min(s.due_on),
       DATE '2026-10-01' - min(s.due_on), sum(s.statement_amount-s.amount_paid)
FROM credit_cards c JOIN credit_card_statements s USING (card_id)
WHERE s.due_on < DATE '2026-10-01' AND s.amount_paid < s.minimum_due
GROUP BY c.customer_id,c.card_id;

CREATE INDEX ON customers(branch_id);
CREATE INDEX ON loans(customer_id);
CREATE INDEX ON loan_installments(loan_id);
CREATE INDEX ON credit_cards(customer_id);
CREATE INDEX ON credit_card_sales(card_id, sold_at);
CREATE INDEX ON credit_card_sales(merchant_id);
CREATE INDEX ON credit_card_statements(card_id);
