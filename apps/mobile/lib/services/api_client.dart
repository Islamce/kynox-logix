import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../models/auth_user.dart';

class ApiClient {
  ApiClient({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;
  static const _tokenKey = 'logix_access_token';
  static const _baseUrl = String.fromEnvironment(
    'LOGIX_API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );

  Uri _uri(String path) => Uri.parse('$_baseUrl/api$path');

  Future<AuthUser> login(String email, String password) async {
    final response = await _client
        .post(
          _uri('/auth/login'),
          headers: {'content-type': 'application/json'},
          body: jsonEncode({'email': email, 'password': password}),
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw ApiException('Unable to sign in', response.statusCode);
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    await _storage.write(key: _tokenKey, value: body['token'] as String);
    return AuthUser.fromJson(body['user'] as Map<String, dynamic>);
  }

  Future<AuthUser> me() async {
    final token = await _storage.read(key: _tokenKey);
    if (token == null) throw const ApiException('Session expired', 401);
    final response = await _client
        .get(_uri('/auth/me'), headers: {'authorization': 'Bearer $token'})
        .timeout(const Duration(seconds: 15));
    if (response.statusCode == 401) {
      await logout();
      throw const ApiException('Session expired', 401);
    }
    if (response.statusCode != 200) {
      throw ApiException('Unable to load profile', response.statusCode);
    }
    return AuthUser.fromJson(
      (jsonDecode(response.body) as Map<String, dynamic>)['user']
          as Map<String, dynamic>,
    );
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
  }
}

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);

  final String message;
  final int statusCode;

  @override
  String toString() => message;
}
