// knk-web-api Dtos/TitleDtos.cs TitleBracketDto (GET api/TitleBrackets, GET {id}, POST search).
// Seeded reference data: a user's title is the highest bracket whose minExperience they reach.
export interface TitleBracketDto {
    id: number;
    // The male name - the form pickers' display name.
    name: string;
    maleName: string;
    femaleName: string;
    minExperience: number;
    salary: number;
    coinBonus: number;
    gemBonus: number;
    expBonus: number;
}
