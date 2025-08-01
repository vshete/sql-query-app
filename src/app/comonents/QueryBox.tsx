/**
 * A component that can be used to enter SQL queries.
 * @returns JSX.Element
 */
export const QueryBox = () => {
    return (
        <div className="query-box">
        <textarea
            className="query-input"
            placeholder="Enter your SQL query here..."
        />
        <button className="execute-button">Execute</button>
        </div>
    );
}