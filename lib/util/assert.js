export function assert(value, message) {
    if (!value) {
        throw new Error(message ?? `Assertion failed: ${value}`);
    }
    return value;
}
/** Similar to assert, but passes for falsey types like 0 and empty string */
export function assertNotNull(value, message) {
    if (value == null) {
        throw new Error(message ?? `Assertion failed: ${value}`);
    }
    return value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXJ0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWwvYXNzZXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sVUFBVSxNQUFNLENBQUksS0FBUSxFQUFFLE9BQWdCO0lBQ2xELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxJQUFJLHFCQUFxQixLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzNELENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCw2RUFBNkU7QUFDN0UsTUFBTSxVQUFVLGFBQWEsQ0FBSSxLQUFRLEVBQUUsT0FBZ0I7SUFDekQsSUFBSSxLQUFLLElBQUksSUFBSSxFQUFFLENBQUM7UUFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLElBQUkscUJBQXFCLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyJ9