<?php
namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->create([
            'name'  => 'Test User1',
            'email' => 'u1@t.t',
        ]);
        User::factory()->create([
            'name'  => 'Test User2',
            'email' => 'u2@t.t',
        ]);
        User::factory()->create([
            'name'  => 'Test User3',
            'email' => 'u3@t.t',
        ]);
        User::factory()->create([
            'name'  => 'Test User4',
            'email' => 'u4@t.t',
        ]);
        User::factory()->create([
            'name'  => 'Test User5',
            'email' => 'u5@t.t',
        ]);
        User::factory()->create([
            'name'  => 'Test User6',
            'email' => 'u6@t.t',
        ]);
        User::factory()->create([
            'name'  => 'Test User7',
            'email' => 'u7@t.t',
        ]);
    }
}
