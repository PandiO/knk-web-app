/** Sample values for the join/leave message previews on the Game Settings page (KNG-52). */
export const PREVIEW_SAMPLE = { player: 'Steve', title: 'Knight', group: 'Default' };

export type PlaceholderValues = { player: string; title: string; group: string };

/** As the plugin's Announcements.fill: an empty value also takes one neighbouring space. */
const fill = (text: string, placeholder: string, value: string): string => {
    if (value.trim()) {
        return text.split(placeholder).join(value.trim());
    }
    return text.split(`${placeholder} `).join('').split(` ${placeholder}`).join('').split(placeholder).join('');
};

/**
 * {@code text} with the message placeholders filled in, as the plugin does (Announcements.render):
 * {player}, {title} (the player's title name, empty if none; alias {titlename}), {group}, and the
 * MOTD's {online}/{max}.
 */
export const fillMessagePlaceholders = (text: string, values: PlaceholderValues): string => {
    let result = (text || '').split('{titlename}').join('{title}');
    result = fill(result, '{group}', values.group);
    result = fill(result, '{title}', values.title);
    return result
        .split('{player}').join(values.player)
        .split('{online}').join('12')
        .split('{max}').join('100');
};
