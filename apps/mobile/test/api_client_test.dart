import 'package:flutter_test/flutter_test.dart';
import 'package:kynox_logix_mobile/models/auth_user.dart';

void main() {
  test('parses the authenticated user DTO without exposing secrets', () {
    final user = AuthUser.fromJson({
      'id': 1,
      'email': 'owner@example.com',
      'name': 'Owner',
      'role': 'admin',
      'password': 'ignored',
    });
    expect(user.email, 'owner@example.com');
    expect(user.role, 'admin');
  });
}
