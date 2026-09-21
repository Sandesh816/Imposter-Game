// Only template literals written by the application are markup. Interpolated
// values are text, including quotes in attributes. Nested html templates may
// supply trusted structural fragments; raw strings can never do so.
class Markup {
    constructor(value) { this.value = value; }
    toString() { return this.value; }
}
function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}
export function html(strings, ...values) {
    let value = strings[0];
    values.forEach((part, index) => {
        value += (part instanceof Markup ? part.value : escapeText(part)) + strings[index + 1];
    });
    return new Markup(value);
}
